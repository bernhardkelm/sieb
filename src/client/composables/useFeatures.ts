import { computed, type ComputedRef } from 'vue'

import type { Features } from '@/router/featureGate'
import { useChecksStore } from '@/stores/checksStore'
import { useMcpStore } from '@/stores/mcpStore'

/**
 * Returns which optional features the server switched on, for the nav items and hints that
 * require them.
 * @returns {ComputedRef<Features>} - Claude integration and Auto-check state
 */
export const useFeatures = (): ComputedRef<Features> => {
  const mcp = useMcpStore()
  const checks = useChecksStore()

  return computed(() => ({ mcp: mcp.enabled, checks: checks.enabled }))
}
