import type { WorkerClaim, WorkerHeartbeat, WorkerResult } from '#core/check.ts'
import { parseClaimText } from '#checker/api/parseClaim.ts'

const REQUEST_TIMEOUT_MS = 15_000

/** Client of sieb's internal worker API */
export interface WorkerApi {
  claim: () => Promise<WorkerClaim | null>
  heartbeat: (checkId: number, body: WorkerHeartbeat) => Promise<'ok' | 'abort'>
  result: (checkId: number, body: WorkerResult) => Promise<void>
}

/** Options of the worker API client */
export interface WorkerApiOptions {
  baseUrl: string
  secret: string
  fetch?: typeof globalThis.fetch
}

/** A non-success answer of the worker API */
export class WorkerApiError extends Error {
  readonly status: number

  /**
   * Creates the error for an HTTP status.
   * @param {string} path - Request path
   * @param {number} status - HTTP status
   * @returns {void}
   */
  constructor(path: string, status: number) {
    super(`${path} answered ${status}`)
    this.name = 'WorkerApiError'
    this.status = status
  }
}

/**
 * Creates the worker API client, every request carries the worker secret as bearer token.
 * @param {WorkerApiOptions} options - Base URL, secret and an optional fetch implementation
 * @returns {WorkerApi} - Claim, heartbeat and result calls
 */
export const createWorkerApi = (options: WorkerApiOptions): WorkerApi => {
  const fetch = options.fetch ?? globalThis.fetch

  /**
   * Sends a JSON POST request to the worker API.
   * @param {string} path - Request path
   * @param {unknown} body - JSON body
   * @returns {Promise<Response>} - Response
   */
  const post = (path: string, body: unknown): Promise<Response> =>
    fetch(`${options.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

  return {
    claim: async () => {
      const response = await post('/worker/claim', {})

      if (response.status === 204) {
        return null
      }

      if (!response.ok) {
        throw new WorkerApiError('/worker/claim', response.status)
      }

      return parseClaimText(await response.text())
    },
    heartbeat: async (checkId, body) => {
      const path = `/worker/checks/${checkId}/heartbeat`
      const response = await post(path, body)

      await response.body?.cancel()
      // 409: cancelled or timed out, 404: the check no longer exists
      if (response.status === 409 || response.status === 404) {
        return 'abort'
      }

      if (!response.ok) {
        throw new WorkerApiError(path, response.status)
      }

      return 'ok'
    },
    result: async (checkId, body) => {
      const path = `/worker/checks/${checkId}/result`
      const response = await post(path, body)

      await response.body?.cancel()
      // 409: sieb already closed the check, nothing left to report
      if (!response.ok && response.status !== 409) {
        throw new WorkerApiError(path, response.status)
      }
    },
  }
}
