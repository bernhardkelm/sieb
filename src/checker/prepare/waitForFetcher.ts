import { errorMessage } from '#core/errorMessage.ts'
import type { FetcherLink } from '#checker/config/fetcherLink.ts'
import { fetcherStatusReason } from '#checker/prepare/fetcherPreparer.ts'
import { postLocal } from '#checker/prepare/localHttp.ts'

const READY_TIMEOUT_MS = 5000
const RETRY_MS = 1000
const LOG_EVERY = 30

/**
 * Asks the fetcher whether it is ready.
 * @param {FetcherLink} link - Loopback URL and local secret
 * @param {AbortSignal} signal - Stop signal of the worker
 * @returns {Promise<number | string>} - HTTP status, or the reason the request failed
 */
const readyStatus = async (link: FetcherLink, signal: AbortSignal): Promise<number | string> => {
  try {
    const answer = await postLocal({
      baseUrl: link.url,
      path: '/ready',
      secret: link.secret,
      body: {},
      signal: AbortSignal.any([signal, AbortSignal.timeout(READY_TIMEOUT_MS)]),
    })

    return answer.status
  } catch (error) {
    return (error as NodeJS.ErrnoException).code ?? errorMessage(error)
  }
}

/**
 * Waits until the fetcher answers its ready call, so the first claim does not race its start.
 * A refused secret ends the wait with an error, since retrying cannot fix it.
 * @param {FetcherLink} link - Loopback URL and local secret
 * @param {AbortSignal} signal - Stop signal of the worker
 * @param {(ms: number, signal: AbortSignal) => Promise<void>} sleep - Waits between attempts
 * @param {(line: string) => void} log - Log writer
 * @returns {Promise<void>} - Resolves once ready or stopped
 * @throws {Error} - When the fetcher refuses the local secret
 */
export const waitForFetcher = async (
  link: FetcherLink,
  signal: AbortSignal,
  sleep: (ms: number, signal: AbortSignal) => Promise<void>,
  log: (line: string) => void,
): Promise<void> => {
  for (let attempt = 0; !signal.aborted; attempt++) {
    const status = await readyStatus(link, signal)

    if (status === 204) {
      return
    }

    if (status === 401) {
      throw new Error(fetcherStatusReason(401))
    }

    if (attempt % LOG_EVERY === 0) {
      const reason = typeof status === 'number' ? fetcherStatusReason(status) : status

      log(`[sieb-checker] waiting for the fetcher at ${link.url}: ${reason}`)
    }

    await sleep(RETRY_MS, signal)
  }
}
