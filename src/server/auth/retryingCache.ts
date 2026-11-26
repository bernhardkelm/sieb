/** A failed discovery is answered from the cache this long before it is tried again */
export const DISCOVERY_RETRY_MS = 30 * 1000

/**
 * Wraps an async lookup so it runs once and its result is reused. A failure is reused too for
 * retryMs, so a flood of requests during an issuer outage costs one outbound request per
 * interval, not one each.
 * @param {() => Promise<T>} load - Lookup
 * @param {{ retryMs?: number; now?: () => number }} options - Failure cache time, time source
 * @returns {() => Promise<T>} - Cached lookup
 */
export const retryingCache = <T>(
  load: () => Promise<T>,
  { retryMs = DISCOVERY_RETRY_MS, now = Date.now }: { retryMs?: number; now?: () => number } = {},
): (() => Promise<T>) => {
  let cached: Promise<T> | null = null
  let failedAt: number | null = null

  return () => {
    if (cached !== null && failedAt !== null && now() - failedAt >= retryMs) {
      cached = null
    }

    if (cached === null) {
      failedAt = null
      cached = load().catch((error: unknown) => {
        failedAt = now()
        throw error
      })
    }

    return cached
  }
}
