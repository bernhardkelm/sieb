import { onBeforeUnmount, readonly, ref, type Ref } from 'vue'

const TICK_MS = 30 * 1000

const now = ref(new Date())
let consumers = 0
let timer: ReturnType<typeof setInterval> | null = null

/**
 * Shares a current time that ticks every 30 seconds while a component uses it, so relative
 * times stay fresh without one timer per row.
 * @returns {Readonly<Ref<Date>>} - Current time
 */
export const useNow = (): Readonly<Ref<Date>> => {
  consumers += 1

  if (timer === null) {
    now.value = new Date()
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
