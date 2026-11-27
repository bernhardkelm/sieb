import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import type { McpInfoResponse } from '#core/mcpApiTypes.ts'
import { fetchMcpInfo } from '@/api/tokensApi'
import { createSharedVisiblePoll } from '@/stores/sharedVisiblePoll'

export const CONNECT_TOKEN_STEP = 'create an API token (your name in the top bar, API tokens)'
export const CONNECT_CONNECTOR_STEP = 'add the sieb connector in claude.ai'

/** Least time between two refreshes on focus or while waiting for the connection, in ms */
export const REFRESH_THROTTLE_MS = 15_000
/** Pause between two refreshes while a blocked hand-off waits for the connection, in ms */
export const CONNECT_POLL_MS = 30_000

/**
 * Holds whether the Claude integration (MCP, tokens, hand-off) is switched on and whether Claude
 * reaches sieb for the acting user, loaded once per page view and refreshed after token changes,
 * on focus and while a blocked hand-off waits for the connection. Until the answer arrives, and
 * when it fails, the integration counts as off, so nothing Claude related flashes up.
 */
export const useMcpStore = defineStore('mcp', () => {
  const info = shallowRef<McpInfoResponse | null>(null)
  let loading: Promise<void> | null = null
  let fetchedAt = Number.NEGATIVE_INFINITY

  const enabled = computed(() => info.value?.enabled === true)
  const connected = computed(() => info.value?.claude?.connected === true)

  const connectReason = computed(() => {
    if (connected.value) {
      return null
    }

    const steps =
      info.value?.oauth === true
        ? `${CONNECT_CONNECTOR_STEP} or ${CONNECT_TOKEN_STEP}`
        : CONNECT_TOKEN_STEP

    return `Connect Claude first: ${steps}.`
  })

  /**
   * Fetches the MCP info and keeps the answer.
   * @param {boolean} keepOnFailure - Whether a failure keeps the previous answer, else it counts as off
   * @returns {Promise<void>} - Resolves when the request settled
   */
  const fetchInfo = (keepOnFailure: boolean): Promise<void> => {
    fetchedAt = Date.now()

    return fetchMcpInfo().then(
      (answer) => {
        info.value = answer
      },
      () => {
        if (!keepOnFailure) {
          info.value = null
        }
      },
    )
  }

  /**
   * Fetches the MCP info once, later calls reuse the first request.
   * @returns {Promise<void>} - Resolves when the request settled
   */
  const load = (): Promise<void> => {
    loading ??= fetchInfo(false)

    return loading
  }

  /**
   * Fetches the MCP info again, so a created or revoked token changes the connection state
   * without a reload. A failure keeps the previous answer.
   * @returns {Promise<void>} - Resolves when the request settled
   */
  const refresh = (): Promise<void> => fetchInfo(true)

  /**
   * Refreshes the MCP info unless the last request started less than REFRESH_THROTTLE_MS ago,
   * for refreshes the user does not ask for, such as focusing the window.
   * @returns {Promise<void>} - Resolves when the request settled or was skipped
   */
  const refreshThrottled = (): Promise<void> =>
    Date.now() - fetchedAt < REFRESH_THROTTLE_MS ? Promise.resolve() : refresh()

  const connectionPoll = createSharedVisiblePoll(refreshThrottled, CONNECT_POLL_MS)

  /**
   * Polls the MCP info every CONNECT_POLL_MS while the page is visible, one poll for all holders.
   * @returns {() => void} - Releases the hold, the last release stops the poll
   */
  const holdConnectionPoll = (): (() => void) => connectionPoll()

  return {
    info,
    enabled,
    connected,
    connectReason,
    load,
    refresh,
    refreshThrottled,
    holdConnectionPoll,
  }
})
