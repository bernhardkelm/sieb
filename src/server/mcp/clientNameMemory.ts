/** Callers and User-Agents whose last client name stays known */
const MAX_ENTRIES = 1000

/** Remembers the last client name per caller and User-Agent across stateless requests */
export interface ClientNameMemory {
  /**
   * Returns the client name of a request: the one it carries, which is remembered, else the last
   * one the same caller sent with the same User-Agent.
   * @param {string} caller - Caller key, such as via and token id or actor
   * @param {string | null} userAgent - User-Agent of the request, capped
   * @param {string | null} seen - Client name the request carries itself
   * @returns {string | null} - Client name, null when none is known
   */
  resolve: (caller: string, userAgent: string | null, seen: string | null) => string | null
}

/**
 * Creates the client name memory. A 2025-era client names itself only in initialize, so a later
 * tools/call of a stateless endpoint would know only its User-Agent; the pair of caller and
 * User-Agent ties it back to its handshake. The oldest entry goes beyond maxEntries.
 * @param {number} maxEntries - Entries kept
 * @returns {ClientNameMemory} - Memory
 */
export const createClientNameMemory = (maxEntries: number = MAX_ENTRIES): ClientNameMemory => {
  const names = new Map<string, string>()

  return {
    resolve: (caller, userAgent, seen) => {
      const key = `${caller}\n${userAgent ?? ''}`

      if (seen === null) {
        return names.get(key) ?? null
      }

      names.delete(key)
      names.set(key, seen)

      const oldest = names.keys().next().value

      if (names.size > maxEntries && oldest !== undefined) {
        names.delete(oldest)
      }

      return seen
    },
  }
}
