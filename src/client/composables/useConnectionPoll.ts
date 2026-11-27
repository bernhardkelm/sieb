import { onScopeDispose, watch } from 'vue'

import { useMcpStore } from '@/stores/mcpStore'

/**
 * Polls the Claude connection state slowly while a hand-off waits for the connection, so it
 * unblocks once the connector or a token reaches sieb. The poll stops when Claude is connected,
 * the integration is off or `waiting` turns false, and is shared with every other waiting caller.
 * @param {() => boolean} waiting - Whether the caller offers a hand-off the connection blocks
 * @returns {void}
 */
export const useConnectionPoll = (waiting: () => boolean): void => {
  const mcp = useMcpStore()
  let release: (() => void) | null = null

  /**
   * Gives up the hold on the poll.
   * @returns {void}
   */
  const releasePoll = (): void => {
    release?.()
    release = null
  }

  const stopWatch = watch(
    () => waiting() && mcp.enabled && !mcp.connected,
    (poll) => {
      if (poll) {
        release ??= mcp.holdConnectionPoll()
      } else {
        releasePoll()
      }
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    stopWatch()
    releasePoll()
  })
}
