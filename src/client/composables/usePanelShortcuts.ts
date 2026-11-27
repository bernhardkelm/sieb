import { useFindingPanel } from '@/composables/useFindingPanel'
import { usePanelAutoCheck } from '@/composables/usePanelAutoCheck'
import { usePanelHandoff } from '@/composables/usePanelHandoff'
import { decisionStatusOfKey } from '@/keyboard/decisionKeymap'
import { isDraftKey } from '@/keyboard/draftKeys'
import { claudeKeyOf } from '@/keyboard/handoffKeymap'
import { isEditableTarget, isShortcutEvent, shortcutScope } from '@/keyboard/keyboardTarget'
import { useChecksStore } from '@/stores/checksStore'
import { useFindingDetailStore } from '@/stores/findingDetailStore'
import { useMcpStore } from '@/stores/mcpStore'

export interface PanelShortcuts {
  onPanelKeydown: (event: KeyboardEvent) => void
  onWindowKeydown: (event: KeyboardEvent) => void
}

/**
 * Handles the keys of the finding panel: a, n and f inside the panel open the decision form,
 * Shift+H runs the default hand-off action, h copies the hand-off prompt for Claude, y the
 * claude command of an own image (all three only with the Claude integration on, a deep link
 * and the command also only while Claude reaches sieb), Shift+C queues an Auto-check (with
 * Auto-check on, the reason of a blocked check stays on the button), Escape in a
 * text entry leaves it, Escape elsewhere closes the panel unless a dialog or popover is open or
 * the decision form holds an unsaved draft.
 * @param {() => void} focusPanel - Moves focus to the panel element
 * @returns {PanelShortcuts} - Keydown handlers for the panel element and the window
 */
export const usePanelShortcuts = (focusPanel: () => void): PanelShortcuts => {
  const { findingId, closeFinding } = useFindingPanel()
  const store = useFindingDetailStore()
  const mcp = useMcpStore()
  const checks = useChecksStore()
  const handoff = usePanelHandoff()
  const autoCheck = usePanelAutoCheck()

  /**
   * Returns the Claude action of a key, Shift+H and Shift+C only with Shift so Caps Lock does
   * nothing.
   * @param {KeyboardEvent} event - Keydown event
   * @returns {(() => unknown) | undefined} - Action, undefined for other keys or with the integration off
   */
  const handoffAction = (event: KeyboardEvent): (() => unknown) | undefined => {
    const key = mcp.enabled ? claudeKeyOf(event) : null

    if (key === 'autoCheck') {
      return checks.enabled ? autoCheck.runOrExplain : undefined
    }

    return key === null ? undefined : () => key.run(handoff)
  }

  /**
   * Handles keys pressed inside the panel.
   * @param {KeyboardEvent} event - Keydown event
   * @returns {void}
   */
  const onPanelKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && isEditableTarget(event.target)) {
      event.preventDefault()
      focusPanel()
      return
    }

    if (!isShortcutEvent(event) || shortcutScope(event.target) !== 'panel') {
      return
    }

    const handoff = handoffAction(event)

    if (handoff) {
      event.preventDefault()
      void handoff()
      return
    }

    const status = decisionStatusOfKey(event.key)

    if (status) {
      const id = store.detail?.finding.id

      if (id !== undefined) {
        event.preventDefault()
        store.requestDecision(id, status)
      }
    }
  }

  /**
   * Closes the panel on Escape.
   * @param {KeyboardEvent} event - Keydown event
   * @returns {void}
   */
  const onWindowKeydown = (event: KeyboardEvent): void => {
    if (
      event.key !== 'Escape' ||
      event.defaultPrevented ||
      findingId.value === null ||
      shortcutScope(event.target) === 'overlay' ||
      (store.draftDirty && isDraftKey(event.key))
    ) {
      return
    }

    event.preventDefault()
    void closeFinding()
  }

  return { onPanelKeydown, onWindowKeydown }
}
