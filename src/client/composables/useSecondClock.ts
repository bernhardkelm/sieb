import { createSharedClock } from '@/composables/sharedClock'

/**
 * Shares a current time that ticks every second while a component uses it, for live elapsed
 * times such as the one of a running check; useNow covers the coarser relative times.
 * @returns {Readonly<Ref<Date>>} - Current time
 */
export const useSecondClock = createSharedClock(1000, { refreshOnUse: true })
