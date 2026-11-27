import { createSharedClock } from '@/composables/sharedClock'

/**
 * Shares a current time that ticks every 30 seconds while a component uses it, so relative
 * times stay fresh without one timer per row.
 * @returns {Readonly<Ref<Date>>} - Current time
 */
export const useNow = createSharedClock(30 * 1000)
