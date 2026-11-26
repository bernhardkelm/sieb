import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import type { McpInfoResponse } from '#core/apiTypes.ts'
import { fetchMcpInfo } from '@/api/tokensApi'

/**
 * Holds whether the Claude integration (MCP, tokens, hand-off) is switched on, loaded once per
 * page view. Until the answer arrives, and when it fails, the integration counts as off, so
 * nothing Claude related flashes up.
 */
export const useMcpStore = defineStore('mcp', () => {
  const info = shallowRef<McpInfoResponse | null>(null)
  let loading: Promise<void> | null = null

  const enabled = computed(() => info.value?.enabled === true)

  /**
   * Fetches the MCP info once, later calls reuse the first request.
   * @returns {Promise<void>} - Resolves when the request settled
   */
  const load = (): Promise<void> => {
    loading ??= fetchMcpInfo().then(
      (answer) => {
        info.value = answer
      },
      () => {
        info.value = null
      },
    )

    return loading
  }

  return { info, enabled, load }
})
