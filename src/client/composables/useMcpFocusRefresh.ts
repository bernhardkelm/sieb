import { onScopeDispose } from 'vue'

import { useMcpStore } from '@/stores/mcpStore'

/**
 * Refreshes the Claude connection state when the window gains focus or the tab becomes visible,
 * throttled by the store, so adding the connector in Claude shows without a reload.
 * @returns {void}
 */
export const useMcpFocusRefresh = (): void => {
  const mcp = useMcpStore()

  /**
   * Refreshes the state while the integration is on.
   * @returns {void}
   */
  const refresh = (): void => {
    if (mcp.enabled && document.visibilityState === 'visible') {
      void mcp.refreshThrottled()
    }
  }

  window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', refresh)

  onScopeDispose(() => {
    window.removeEventListener('focus', refresh)
    document.removeEventListener('visibilitychange', refresh)
  })
}
