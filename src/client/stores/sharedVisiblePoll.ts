import { createVisiblePoll } from '@/stores/visiblePoll'

/**
 * Shares one visible poll between several holders: the first hold starts it, releasing the last
 * one stops it. Releasing a hold twice counts once.
 * @param {() => Promise<void>} task - Task, such as a refetch
 * @param {number} intervalMs - Pause between two runs in ms
 * @returns {() => () => void} - Takes a hold and returns its release
 */
export const createSharedVisiblePoll = (
  task: () => Promise<void>,
  intervalMs: number,
): (() => () => void) => {
  const poll = createVisiblePoll(task, intervalMs)
  let holders = 0

  return () => {
    let held = true

    holders += 1

    if (holders === 1) {
      poll.start()
    }

    return () => {
      if (!held) {
        return
      }

      held = false
      holders -= 1

      if (holders === 0) {
        poll.stop()
      }
    }
  }
}
