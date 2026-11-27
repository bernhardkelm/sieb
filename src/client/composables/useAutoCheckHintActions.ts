import { useHintActions } from '@/composables/useHintActions'
import { usePanelAutoCheck, type PanelAutoCheck } from '@/composables/usePanelAutoCheck'
import { useSelectionAutoCheck } from '@/composables/useSelectionAutoCheck'
import { FINDING_NOUN } from '@/format/bulkCount'

/**
 * Registers the Auto-check hint action, which queues checks as Shift+C does: of the checked rows
 * while some are checked, else of the panel finding, blocked with the reason the button shows.
 * With checked rows the hint counts the findings it queues.
 * @returns {void}
 */
export const useAutoCheckHintActions = (): void => {
  const panel = usePanelAutoCheck()
  const selection = useSelectionAutoCheck()

  /**
   * Returns the Auto-check the hint acts on now.
   * @returns {Pick<PanelAutoCheck, 'blockedBy' | 'run'>} - Selection with checked rows, else the panel
   */
  const current = (): Pick<PanelAutoCheck, 'blockedBy' | 'run'> =>
    selection.active.value ? selection : panel

  useHintActions({
    autoCheck: {
      run: () => {
        void current().run()
      },
      blockedBy: () => current().blockedBy.value,
      bulk: () =>
        selection.active.value ? { count: selection.bulkCount.value, noun: FINDING_NOUN } : null,
    },
  })
}
