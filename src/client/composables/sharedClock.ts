import { onBeforeUnmount, readonly, ref, type Ref } from 'vue'

import { createHold } from '@/stores/hold'

export interface SharedClockOptions {
  /** Sets the current time on every use, not only when the first user starts the timer */
  refreshOnUse?: boolean
}

/**
 * Creates a current time shared by all components that use it, ticking on one timer while at
 * least one of them is mounted.
 * @param {number} tickMs - Pause between two ticks in ms
 * @param {SharedClockOptions} options - When the time is set outside the ticks
 * @returns {() => Readonly<Ref<Date>>} - Composable that returns the current time
 */
export const createSharedClock = (
  tickMs: number,
  { refreshOnUse = false }: SharedClockOptions = {},
): (() => Readonly<Ref<Date>>) => {
  const now = ref(new Date())
  let timer: ReturnType<typeof setInterval> | null = null

  const hold = createHold(
    () => {
      now.value = new Date()
      timer = setInterval(() => {
        now.value = new Date()
      }, tickMs)
    },
    () => {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    },
  )

  return () => {
    if (refreshOnUse) {
      now.value = new Date()
    }

    onBeforeUnmount(hold.take())

    return readonly(now)
  }
}
