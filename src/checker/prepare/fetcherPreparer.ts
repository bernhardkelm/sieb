import { access, constants } from 'node:fs/promises'

import { errorMessage } from '#core/errorMessage.ts'
import { claimImages } from '#checker/api/claimImages.ts'
import { CheckFailure } from '#checker/CheckFailure.ts'
import type { FetcherLink } from '#checker/config/fetcherLink.ts'
import { postLocal } from '#checker/prepare/localHttp.ts'
import { parsePrepareAnswer, parsePrepareError } from '#checker/prepare/parsePrepareAnswer.ts'
import type { PrepareRequest, WorkspacePreparer } from '#checker/prepare/prepareTypes.ts'

// the fetcher stops its tools at the deadline, the request waits a little longer for its answer
const ANSWER_GRACE_MS = 15_000
const RELEASE_TIMEOUT_MS = 60_000

/**
 * Names a non-success status of the fetcher.
 * @param {number} status - HTTP status
 * @returns {string} - Short reason
 */
export const fetcherStatusReason = (status: number): string => {
  if (status === 401) {
    return 'the fetcher refused the local secret, check SIEB_FETCHER_LOCAL_SECRET of both containers'
  }

  if (status === 409) {
    return 'the fetcher is busy with another check'
  }

  return `the fetcher answered ${status}`
}

/**
 * Checks that the checker can read the workspace the fetcher filled.
 * @param {string} workspace - Shared workspace of the check
 * @returns {Promise<void>}
 * @throws {CheckFailure} - When the directory is missing or not readable
 */
const ensureReadable = async (workspace: string): Promise<void> => {
  try {
    await access(workspace, constants.R_OK | constants.X_OK)
  } catch {
    throw new CheckFailure(
      'the shared workspace is not readable, check SIEB_CHECKER_SHARED_DIR and the group of both containers',
    )
  }
}

/**
 * Maps a failed request to the check failure, leaving an abort of the check to its reason.
 * @param {unknown} error - Request error
 * @param {AbortSignal} checkSignal - Abort signal of the check
 * @param {AbortSignal} timeout - Deadline signal of the request
 * @returns {unknown} - Error to throw
 */
const requestFailure = (
  error: unknown,
  checkSignal: AbortSignal,
  timeout: AbortSignal,
): unknown => {
  if (checkSignal.aborted) {
    return error
  }

  if (timeout.aborted) {
    return new CheckFailure('image preparation timed out')
  }

  const code = (error as NodeJS.ErrnoException).code

  return new CheckFailure(`the fetcher is unreachable: ${code ?? errorMessage(error)}`)
}

/**
 * Creates the preparer of two-container mode: the fetcher pulls the images and checks out the
 * source into the shared workspace, the checker only reads it.
 * @param {FetcherLink} link - Loopback URL and local secret
 * @param {(line: string) => void} log - Log writer
 * @param {number} graceMs - Wait for the answer past the check deadline, shortened in tests
 * @returns {WorkspacePreparer} - Prepare and release calls
 */
export const createFetcherPreparer = (
  link: FetcherLink,
  log: (line: string) => void,
  graceMs: number = ANSWER_GRACE_MS,
): WorkspacePreparer => ({
  prepare: async (claim, layout, context, onPulled) => {
    const remainingMs = Math.max(0, Math.round(context.remainingMs()))
    const timeout = AbortSignal.timeout(remainingMs + graceMs)
    const body: PrepareRequest = {
      checkId: claim.checkId,
      images: claimImages(claim),
      timeoutMs: remainingMs,
    }
    let answer

    try {
      answer = await postLocal({
        baseUrl: link.url,
        path: '/prepare',
        secret: link.secret,
        body,
        signal: AbortSignal.any([context.signal, timeout]),
      })
    } catch (error) {
      throw requestFailure(error, context.signal, timeout)
    }

    if (answer.status === 200) {
      const prepared = parsePrepareAnswer(answer.body)

      onPulled(prepared.images.prepared)
      await ensureReadable(layout.workspace)

      return prepared
    }

    if (answer.status === 422) {
      const failure = parsePrepareError(answer.body)

      onPulled(failure.pulled)
      throw new CheckFailure(failure.error)
    }

    throw new CheckFailure(fetcherStatusReason(answer.status))
  },
  release: async (checkId) => {
    try {
      const answer = await postLocal({
        baseUrl: link.url,
        path: '/release',
        secret: link.secret,
        body: { checkId },
        signal: AbortSignal.timeout(RELEASE_TIMEOUT_MS),
      })

      if (answer.status !== 204) {
        log(
          `[sieb-checker] fetcher release of check ${checkId}: ${fetcherStatusReason(answer.status)}`,
        )
      }
    } catch (error) {
      log(`[sieb-checker] fetcher release of check ${checkId} failed: ${errorMessage(error)}`)
    }
  },
})
