import { createHash } from 'node:crypto'

import type { Clock } from '#core/clock.ts'

export const MAX_CONSUMED_LOGINS = 5000

export interface ConsumedLogins {
  consume: (state: string, expiresAtMs: number) => boolean
  size: () => number
}

/**
 * Creates the memory of used login cookies, which makes a sealed login single use: the sha-256
 * of its state is kept until the seal expires, at most max entries with the oldest evicted. A
 * restart forgets them, which is safe because the restart also changes the sealing key.
 * @param {{ clock: Clock; max?: number }} options - Clock, capacity
 * @returns {ConsumedLogins} - Store
 */
export const createConsumedLogins = ({
  clock,
  max = MAX_CONSUMED_LOGINS,
}: {
  clock: Clock
  max?: number
}): ConsumedLogins => {
  const used = new Map<string, number>()

  return {
    consume: (state, expiresAtMs) => {
      const now = clock().getTime()
      const key = createHash('sha256').update(state, 'utf8').digest('hex')

      for (const [entry, expiry] of used) {
        if (expiry > now) {
          break
        }

        used.delete(entry)
      }

      if (used.has(key)) {
        return false
      }

      while (used.size >= max) {
        const oldest = used.keys().next().value

        if (oldest === undefined) {
          break
        }

        used.delete(oldest)
      }

      used.set(key, expiresAtMs)
      return true
    },
    size: () => used.size,
  }
}
