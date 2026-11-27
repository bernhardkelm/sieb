import { rm } from 'node:fs/promises'

import { errorMessage } from '#core/errorMessage.ts'
import type { SourceAnswer } from '#core/privateAccess.ts'
import type { FetcherApi } from '#checker/fetcher/fetcherApi.ts'
import type { FetcherConfig } from '#checker/fetcher/fetcherConfig.ts'
import type { FetchLayout } from '#checker/fetcher/fetchLayout.ts'
import type { SecretList } from '#checker/fetcher/secretList.ts'
import type { SourceOutcome } from '#checker/prepare/prepareTypes.ts'
import type { ProcessRunner } from '#checker/process/processRunner.ts'
import { cloneSource } from '#checker/source/cloneSource.ts'
import { labelNamesRepo, readSourceLabels } from '#checker/source/imageLabels.ts'
import { tidySource } from '#checker/source/tidySource.ts'
import { imageDirLayout } from '#checker/workspace/checkLayout.ts'
import { repositoryOf } from '#checker/workspace/imageRef.ts'
import type { PreparedImage } from '#checker/workspace/prepareWorkspace.ts'

// the source must leave Claude most of the check time
const SOURCE_TIMEOUT_MS = 5 * 60_000
const SIZE_POLL_MS = 1000
// sieb accepts a revision as 7 to 64 hex characters only
const REVISION_PATTERN = /^[0-9a-f]{7,64}$/i

/** What the source step needs */
export interface SourceDeps {
  api: FetcherApi
  runner: ProcessRunner
  config: FetcherConfig
  layout: FetchLayout
  signal: AbortSignal
  remainingMs: () => number
  secrets: SecretList // receives the git login, so no log line repeats it
  log: (line: string) => void
  pollMs?: number
}

/**
 * Asks sieb for the source of the primary image, from its OCI labels, and checks it out into
 * source/ of the workspace. Every way to end without source is an outcome, never a failure of
 * the check, except an abort.
 * @param {number} checkId - Check id
 * @param {PreparedImage} primary - Pulled primary image
 * @param {SourceDeps} deps - sieb client, runner, config, paths, abort signal, deadline, secrets and log
 * @returns {Promise<SourceOutcome>} - The checkout or why there is none
 * @throws {CheckFailure} - When the check was aborted
 */
export const fetchSource = async (
  checkId: number,
  primary: PreparedImage,
  deps: SourceDeps,
): Promise<SourceOutcome> => {
  const { layout, config } = deps
  const labels = await readSourceLabels(imageDirLayout(layout, primary.dir).config)
  let answer: SourceAnswer

  try {
    answer = await deps.api.source(checkId, {
      imageRef: repositoryOf(primary.claimRef),
      sourceLabel: labels.sourceLabel,
      revisionLabel: REVISION_PATTERN.test(labels.revisionLabel ?? '')
        ? labels.revisionLabel
        : null,
    })
  } catch (error) {
    if (deps.signal.aborted) {
      throw error
    }

    deps.log(`[sieb-fetcher] check ${checkId}: ${errorMessage(error)}`)

    return { missing: 'unavailable' }
  }

  if ('skip' in answer) {
    return { missing: answer.skip }
  }

  const { grant } = answer

  deps.secrets.add(grant.username, grant.secret)

  const clone = await cloneSource(layout.source, grant, grant.revision, {
    runner: deps.runner,
    base: { PATH: config.path, HOME: layout.home, TMPDIR: layout.tmp },
    signal: deps.signal,
    timeoutMs: Math.min(SOURCE_TIMEOUT_MS, deps.remainingMs()),
    maxBytes: config.sourceMaxBytes,
    pollMs: deps.pollMs ?? SIZE_POLL_MS,
    log: deps.log,
  })

  if (!clone.ok) {
    deps.log(`[sieb-fetcher] check ${checkId}: no source from ${grant.repoUrl}: ${clone.detail}`)
    await rm(layout.source, { recursive: true, force: true })

    return { missing: clone.reason }
  }

  if (!(await tidySource(layout.source, config.sourceMaxBytes))) {
    await rm(layout.source, { recursive: true, force: true })

    return { missing: 'too_large' }
  }

  return {
    checked: {
      repoUrl: grant.repoUrl,
      revision: clone.revision,
      fromLabel: labelNamesRepo(labels.sourceLabel, grant.repoUrl),
    },
  }
}
