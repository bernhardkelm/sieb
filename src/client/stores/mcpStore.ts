import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import type { McpInfoResponse } from '#core/apiTypes.ts'
import { fetchMcpInfo } from '@/api/tokensApi'

export const CONNECT_TOKEN_STEP = 'create an API token (your name in the top bar, API tokens)'
export const CONNECT_CONNECTOR_STEP = 'add the sieb connector in Claude'

/**
 * Holds whether the Claude integration (MCP, tokens, hand-off) is switched on and whether Claude
 * reaches sieb for the acting user, loaded once per page view and refreshed after token changes.
 * Until the answer arrives, and when it fails, the integration counts as off, so nothing Claude
 * related flashes up.
 */
export const useMcpStore = defineStore('mcp', () => {
  const info = shallowRef<McpInfoResponse | null>(null)
  let loading: Promise<void> | null = null

  const enabled = computed(() => info.value?.enabled === true)
  const connected = computed(() => info.value?.claude?.connected === true)

  const connectReason = computed(() => {
    if (connected.value) {
      return null
    }

    const steps = info.value?.oauth === true ? ` or ${CONNECT_CONNECTOR_STEP}` : ''

    return `Connect Claude first: ${CONNECT_TOKEN_STEP}${steps}.`
  })

  /**
   * Fetches the MCP info and keeps the answer, a failure counts as off.
   * @returns {Promise<void>} - Resolves when the request settled
   */
  const fetchInfo = (): Promise<void> =>
    fetchMcpInfo().then(
      (answer) => {
        info.value = answer
      },
      () => {
        info.value = null
      },
    )

  /**
   * Fetches the MCP info once, later calls reuse the first request.
   * @returns {Promise<void>} - Resolves when the request settled
   */
  const load = (): Promise<void> => {
    loading ??= fetchInfo()

    return loading
  }

  /**
   * Fetches the MCP info again, so a created or revoked token changes the connection state
   * without a reload. A failure keeps the previous answer.
   * @returns {Promise<void>} - Resolves when the request settled
   */
  const refresh = (): Promise<void> =>
    fetchMcpInfo().then(
      (answer) => {
        info.value = answer
      },
      () => undefined,
    )

  return { info, enabled, connected, connectReason, load, refresh }
})
