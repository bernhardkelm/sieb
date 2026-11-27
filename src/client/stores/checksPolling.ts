import { createVisiblePoll } from '@/stores/visiblePoll'

export interface ChecksPolling {
  /** Starts polling unless already polling or canStart refuses */
  start: () => void
  stop: () => void
  /** Fetches now and restarts the interval, nothing while stopped */
  runNow: () => void
  /** Marks the Checks page as shown and starts or kicks the poll, the returned function unmarks it */
  showPage: () => () => void
}

/**
 * Polls the checks while the page is visible, with a pause that follows the data and whether
 * the Checks page shows.
 * @param {() => Promise<void>} task - Refetch
 * @param {(pageShown: boolean) => number} interval - Pause in ms before the next refetch
 * @param {() => boolean} canStart - Whether polling may start, false while the feature is off
 * @returns {ChecksPolling} - Start, stop, immediate run and page marker
 */
export const createChecksPolling = (
  task: () => Promise<void>,
  interval: (pageShown: boolean) => number,
  canStart: () => boolean,
): ChecksPolling => {
  let polling = false
  let pageViewers = 0
  const poll = createVisiblePoll(task, () => interval(pageViewers > 0))

  /**
   * Starts polling once.
   * @returns {void}
   */
  const start = (): void => {
    if (!polling && canStart()) {
      polling = true
      poll.start()
    }
  }

  /**
   * Stops polling.
   * @returns {void}
   */
  const stop = (): void => {
    polling = false
    poll.stop()
  }

  return {
    start,
    stop,
    runNow: poll.runNow,
    showPage: () => {
      pageViewers += 1

      if (polling) {
        poll.runNow()
      } else {
        start()
      }

      return () => {
        pageViewers = Math.max(0, pageViewers - 1)
      }
    },
  }
}
