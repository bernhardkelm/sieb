import { onBeforeUnmount, readonly, ref, type Ref } from 'vue'

const TICK_MS = 1000

const now = ref(new Date())
let consumers = 0
let timer: ReturnType<typeof setInterval> | null = null

/**
 * Shares a current time that ticks every second while a component uses it, for live elapsed
 * times such as the one of a running check; useNow covers the coarser relative times.
 * @returns {Readonly<Ref<Date>>} - Current time
 */
export const useSecondClock = (): Readonly<Ref<Date>> => {
  consumers += 1
  now.value = new Date()

  if (timer === null) {
    timer = setInterval(() => {
      now.value = new Date()
    }, TICK_MS)
  }

  onBeforeUnmount(() => {
    consumers -= 1

    if (consumers === 0 && timer !== null) {
      clearInterval(timer)
      timer = null
    }
  })

  return readonly(now)
}
