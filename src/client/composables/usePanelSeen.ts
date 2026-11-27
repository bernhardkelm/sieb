import { provide } from 'vue'

import { PANEL_ACTION } from '@/components/finding/panelAction'
import { useFindingDwell } from '@/composables/useFindingDwell'
import { useFindingDetailStore } from '@/stores/findingDetailStore'
import { useFindingSeenStore } from '@/stores/findingSeenStore'

/**
 * Marks the finding of the side panel seen once it stayed shown long enough, and provides the
 * action callback that copy and hand-off buttons inside the panel run.
 * @returns {() => void} - Marks the shown finding seen, for actions the panel handles itself
 */
export const usePanelSeen = (): (() => void) => {
  const detail = useFindingDetailStore()
  const seen = useFindingSeenStore()

  provide(PANEL_ACTION, seen.markShown)
  useFindingDwell(
    () => detail.detail?.finding.id ?? null,
    (id) => {
      seen.markSeen([id])
    },
  )

  return seen.markShown
}
