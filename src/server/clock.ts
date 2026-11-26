import type { Clock } from '#core/clock.ts'

/**
 * Returns the current system time, the clock the server injects into core logic.
 * @returns {Date} - Now
 */
export const systemClock: Clock = () => new Date()
