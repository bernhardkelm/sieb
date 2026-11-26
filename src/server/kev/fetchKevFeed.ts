import { parseKevFeed, type KevFeed } from '#server/kev/parseKevFeed.ts'
import { readCappedText } from '#server/kev/readCappedText.ts'

export const KEV_FETCH_TIMEOUT_MS = 60_000
export const KEV_MAX_BYTES = 16 * 1024 * 1024

export interface KevFetchOptions {
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
  maxBytes?: number
}

/**
 * Downloads and validates the CISA KEV feed. The timeout covers the whole download.
 * @param {string} url - Feed URL, the CISA feed or a mirror
 * @param {KevFetchOptions} options - Optional fetch implementation, timeout and size limit
 * @returns {Promise<KevFeed>} - Validated catalog
 * @throws {Error} - For network errors, timeouts, non-2xx answers, oversized or invalid bodies
 */
export const fetchKevFeed = async (
  url: string,
  {
    fetch: fetchFn = globalThis.fetch,
    timeoutMs = KEV_FETCH_TIMEOUT_MS,
    maxBytes = KEV_MAX_BYTES,
  }: KevFetchOptions = {},
): Promise<KevFeed> => {
  const response = await fetchFn(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`GET ${url} failed with ${response.status}`)
  }

  const text = await readCappedText(response, maxBytes)
  let json: unknown

  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`GET ${url} answered invalid JSON`)
  }

  return parseKevFeed(json)
}
