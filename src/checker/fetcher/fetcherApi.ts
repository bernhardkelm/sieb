import type { FetchAccess, SourceAnswer, SourceRequest } from '#core/privateAccess.ts'
import { errorMessage } from '#core/errorMessage.ts'
import { CheckFailure } from '#checker/CheckFailure.ts'
import { parseFetchAccess, parseSourceAnswer } from '#checker/fetcher/parseAccess.ts'

const REQUEST_TIMEOUT_MS = 15_000

/** Client of sieb's fetcher routes on the worker listener */
export interface FetcherApi {
  access: (checkId: number) => Promise<FetchAccess>
  source: (checkId: number, body: SourceRequest) => Promise<SourceAnswer>
}

/** Options of the fetcher API client */
export interface FetcherApiOptions {
  baseUrl: string
  secret: string // SIEB_FETCHER_SECRET
  fetch?: typeof globalThis.fetch
}

/**
 * Reads the error code of a refusal.
 * @param {Response} response - 404 or 409 answer
 * @returns {Promise<string | null>} - Code, null without a JSON error body
 */
const refusalOf = async (response: Response): Promise<string | null> => {
  try {
    const body = (await response.json()) as { error?: unknown }

    return typeof body.error === 'string' ? body.error : null
  } catch {
    return null
  }
}

/**
 * Creates the client of sieb's fetcher routes, every request carries the fetcher secret as
 * bearer token. A 409 not_pullable means the check's finding has no pullable image left, any
 * other 404 or 409 that the check is no longer running.
 * @param {FetcherApiOptions} options - Base URL, secret and an optional fetch implementation
 * @returns {FetcherApi} - Access and source calls
 */
export const createFetcherApi = (options: FetcherApiOptions): FetcherApi => {
  const fetch = options.fetch ?? globalThis.fetch

  /**
   * Posts JSON to a fetcher route and returns the parsed answer.
   * @param {string} step - Step name for the error text
   * @param {string} path - Request path
   * @param {unknown} body - JSON body
   * @returns {Promise<unknown>} - Parsed JSON answer
   * @throws {CheckFailure} - For a failed request, a non-success status or a body that is no JSON
   */
  const post = async (step: string, path: string, body: unknown): Promise<unknown> => {
    let response: Response

    try {
      response = await fetch(`${options.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${options.secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (error) {
      throw new CheckFailure(`${step} failed: ${errorMessage(error)}`)
    }

    if (response.status === 404 || response.status === 409) {
      throw new CheckFailure(
        (await refusalOf(response)) === 'not_pullable'
          ? 'the image is no longer pullable'
          : 'the check is no longer running in sieb',
      )
    }

    if (!response.ok) {
      await response.body?.cancel()
      throw new CheckFailure(`${step} failed: sieb answered ${response.status}`)
    }

    try {
      return await response.json()
    } catch {
      throw new CheckFailure(`${step} failed: the answer is no JSON`)
    }
  }

  return {
    access: async (checkId) =>
      parseFetchAccess(
        await post('registry access request', `/worker/checks/${checkId}/access`, {}),
      ),
    source: async (checkId, body) =>
      parseSourceAnswer(await post('source request', `/worker/checks/${checkId}/source`, body)),
  }
}
