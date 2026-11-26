import type { ComputedRef } from 'vue'

import { useQueryParam } from '@/composables/useQueryParam'
import { FINDING_QUERY } from '@/router/routeNames'

/**
 * Reads and changes the finding shown in the side panel, kept in the `finding` query param so
 * every view can open it and the URL stays shareable. Changes replace the history entry, so
 * moving through a list does not flood the back button.
 * @returns {{ findingId: ComputedRef<string | null>, openFinding: (id: string) => Promise<void>, closeFinding: () => Promise<void> }} - Open id and setters
 */
export const useFindingPanel = (): {
  findingId: ComputedRef<string | null>
  openFinding: (id: string) => Promise<void>
  closeFinding: () => Promise<void>
} => {
  const { value: findingId, set } = useQueryParam(FINDING_QUERY)

  /**
   * Opens the side panel for a finding.
   * @param {string} id - Finding id
   * @returns {Promise<void>} - Resolves after navigation
   */
  const openFinding = (id: string): Promise<void> => set(id)

  /**
   * Closes the side panel.
   * @returns {Promise<void>} - Resolves after navigation
   */
  const closeFinding = (): Promise<void> => set(null)

  return { findingId, openFinding, closeFinding }
}
