import { createHold } from '@/stores/hold'
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

  return createHold(poll.start, poll.stop).take
}
