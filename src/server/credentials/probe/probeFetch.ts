/** Time limits of a credential test */
export interface ProbeTimings {
  requestMs: number // one request
  totalMs: number // the whole test
}

export const DEFAULT_PROBE_TIMINGS: ProbeTimings = { requestMs: 10_000, totalMs: 45_000 }

/** How a probe sends requests */
export interface ProbeOptions {
  fetch: typeof globalThis.fetch
  signal: AbortSignal // ends with the whole test
  requestMs: number
}

/** Outcome of one probe: null when the target was reachable, else a short reason */
export type ProbeOutcome = string | null

/**
 * Sends one probe request without following redirects, so credentials never travel to a host
 * a redirect names, and with the request and test time limits.
 * @param {ProbeOptions} options - Fetch, test signal and request limit
 * @param {string} url - https URL
 * @param {RequestInit} init - Method and headers
 * @returns {Promise<Response>} - Response, a redirect included
 */
export const probeRequest = (
  options: ProbeOptions,
  url: string,
  init: RequestInit,
): Promise<Response> =>
  options.fetch(url, {
    ...init,
    redirect: 'manual',
    signal: AbortSignal.any([options.signal, AbortSignal.timeout(options.requestMs)]),
  })

/**
 * Names a failed request: timeout for an aborted or timed out one, the reason of a refused
 * target such as address not allowed, unreachable otherwise.
 * @param {unknown} error - Caught value
 * @returns {string} - Reason
 */
export const errorReason = (error: unknown): string => {
  const name = error instanceof Error ? error.name : ''

  if (name === 'ProbeRefused') {
    return (error as Error).message
  }

  return name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'unreachable'
}

/**
 * Names an unexpected status.
 * @param {number} status - HTTP status
 * @returns {string} - Reason such as "401 unauthorized" or "not found"
 */
export const statusReason = (status: number): string => {
  if (status >= 300 && status < 400) {
    return 'redirect refused'
  }

  const known: Record<number, string> = {
    401: '401 unauthorized',
    403: '403 forbidden',
    404: 'not found',
    429: '429 rate limited',
  }

  return known[status] ?? `HTTP ${status}`
}

/**
 * Builds a basic Authorization header.
 * @param {string} username - Username
 * @param {string} secret - Secret
 * @returns {string} - Header value
 */
export const basicAuth = (username: string, secret: string): string =>
  `Basic ${Buffer.from(`${username}:${secret}`, 'utf8').toString('base64')}`

/**
 * Discards an unread body so the connection can be reused.
 * @param {Response} response - Response
 * @returns {Promise<void>}
 */
export const discardBody = async (response: Response): Promise<void> => {
  await response.body?.cancel().catch(() => {})
}
