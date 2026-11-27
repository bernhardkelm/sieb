import { onScopeDispose, watch } from 'vue'

/** Time a finding has to stay shown in the side panel to count as seen */
export const DWELL_MS = 2000

/**
 * Reports a finding once it stayed shown for DWELL_MS, so skimming the list with the panel
 * following the cursor marks nothing. A change of the shown finding restarts the time, a hidden
 * tab pauses it and the time runs on when the tab shows again. Each showing reports at most once.
 * @param {() => number | null} shownId - Id of the finding shown, null while none is
 * @param {(id: number) => void} onDwell - Receives the id once the time is reached
 * @param {number} dwellMs - Time to reach
 * @returns {void}
 */
export const useFindingDwell = (
  shownId: () => number | null,
  onDwell: (id: number) => void,
  dwellMs = DWELL_MS,
): void => {
  let id: number | null = null
  let remaining = 0
  let startedAt = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  /**
   * Stops the timer and keeps the time still to wait.
   * @returns {void}
   */
  const pause = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
      remaining -= Date.now() - startedAt
    }
  }

  /**
   * Starts the timer for the remaining time while a finding waits and the tab shows.
   * @returns {void}
   */
  const resume = (): void => {
    if (id === null || timer !== undefined || document.visibilityState === 'hidden') {
      return
    }

    const current = id

    startedAt = Date.now()
    timer = setTimeout(
      () => {
        timer = undefined
        id = null
        onDwell(current)
      },
      Math.max(remaining, 0),
    )
  }

  /**
   * Pauses or resumes with the visibility of the tab.
   * @returns {void}
   */
  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      pause()
    } else {
      resume()
    }
  }

  watch(
    shownId,
    (next) => {
      pause()
      id = next
      remaining = dwellMs
      resume()
    },
    { immediate: true },
  )

  document.addEventListener('visibilitychange', onVisibilityChange)

  onScopeDispose(() => {
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })
}
