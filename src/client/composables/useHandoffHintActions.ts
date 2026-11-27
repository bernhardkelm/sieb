import type { HandoffActions } from '@/composables/HandoffActions'
import { useHintActions } from '@/composables/useHintActions'
import { usePanelHandoff } from '@/composables/usePanelHandoff'
import { useSelectionHandoff } from '@/composables/useSelectionHandoff'
import { FINDING_NOUN } from '@/format/bulkCount'
import { HANDOFF_KEYMAP } from '@/keyboard/handoffKeymap'
import type { HintActions, HintBulk } from '@/keyboard/hintActions'

/**
 * Registers the hand-off hint actions: Open in Claude runs the default hand-off action as
 * Shift+H does, Copy for Claude copies the prompt as h does, Copy claude command copies the
 * command of own images as y does. With checked rows they act on the selection, else on the
 * panel finding, and with checked rows the hints count the findings the prompt lists. Open and
 * the command stay blocked while Claude cannot reach sieb, Copy for Claude does not.
 * @returns {void}
 */
export const useHandoffHintActions = (): void => {
  const panel = usePanelHandoff()
  const selection = useSelectionHandoff()

  /**
   * Returns the hand-off the hints act on now.
   * @returns {HandoffActions} - Selection hand-off with checked rows, else the panel one
   */
  const current = (): HandoffActions => (selection.active.value ? selection : panel)

  /**
   * Returns the checked rows the hand-off carries.
   * @returns {HintBulk | null} - Count and noun, null without checked rows
   */
  const bulk = (): HintBulk | null =>
    selection.active.value ? { count: selection.count.value, noun: FINDING_NOUN } : null

  useHintActions(
    Object.fromEntries(
      HANDOFF_KEYMAP.map((key) => [
        key.hintId,
        {
          run: () => {
            void key.run(current())
          },
          blockedBy: () => key.blockedBy(current()),
          bulk,
        },
      ]),
    ) as HintActions,
  )
}
