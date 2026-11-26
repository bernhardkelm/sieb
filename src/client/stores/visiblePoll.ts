export interface VisiblePoll {
  /** Runs the task now and then every interval while the page is visible */
  start: () => void
  stop: () => void
}

/**
 * Repeats a task on an interval while the page is visible. A hidden tab pauses the timer, and
 * the tab becoming visible again runs the task at once before the next interval starts.
 * @param {() => Promise<void>} task - Task, such as a refetch
 * @param {number} intervalMs - Pause between two runs in ms
 * @returns {VisiblePoll} - Start and stop
 */
export const createVisiblePoll = (task: () => Promise<void>, intervalMs: number): VisiblePoll => {
  let timer: ReturnType<typeof setTimeout> | null = null
  let active = false

  /**
   * Clears the pending run.
   * @returns {void}
   */
  const clear = (): void => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  /**
   * Runs the task and schedules the next run while still active and visible.
   * @returns {Promise<void>} - Resolves after the run
   */
  const tick = async (): Promise<void> => {
    clear()
    await task()

    if (active && document.visibilityState === 'visible') {
      clear()
      timer = setTimeout(() => {
        void tick()
      }, intervalMs)
    }
  }

  /**
   * Pauses on a hidden page and catches up on a visible one.
   * @returns {void}
   */
  const onVisibility = (): void => {
    if (document.visibilityState === 'visible') {
      void tick()
    } else {
      clear()
    }
  }

  return {
    start: () => {
      if (active) {
        return
      }

      active = true
      document.addEventListener('visibilitychange', onVisibility)
      void tick()
    },
    stop: () => {
      active = false
      clear()
      document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}
