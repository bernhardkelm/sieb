import type { DecisionStatus } from '#core/decision.ts'
import { useFindingPanel } from '@/composables/useFindingPanel'
import { usePanelHandoff } from '@/composables/usePanelHandoff'
import { isDraftKey } from '@/keyboard/draftKeys'
import { isEditableTarget, isShortcutEvent, shortcutScope } from '@/keyboard/keyboardTarget'
import { useFindingDetailStore } from '@/stores/findingDetailStore'
import { useMcpStore } from '@/stores/mcpStore'

export const DECISION_KEYS: Record<string, DecisionStatus> = {
  a: 'accepted',
  n: 'not_affected',
  f: 'fix_planned',
}

export interface PanelShortcuts {
  onPanelKeydown: (event: KeyboardEvent) => void
  onWindowKeydown: (event: KeyboardEvent) => void
}

/**
 * Handles the keys of the finding panel: a, n and f inside the panel open the decision form,
 * Shift+H runs the default hand-off action, h copies the hand-off prompt for Claude, y the
 * claude command of an own image (all three only with the Claude integration on), Escape in a
 * text entry leaves it, Escape elsewhere closes the panel unless a dialog or popover is open or
 * the decision form holds an unsaved draft.
 * @param {() => void} focusPanel - Moves focus to the panel element
 * @returns {PanelShortcuts} - Keydown handlers for the panel element and the window
 */
export const usePanelShortcuts = (focusPanel: () => void): PanelShortcuts => {
  const { findingId, closeFinding } = useFindingPanel()
  const store = useFindingDetailStore()
  const mcp = useMcpStore()
  const { copyPrompt, copyCommand, openPreferred } = usePanelHandoff()
  const handoffKeys: Record<string, () => unknown> = {
    h: copyPrompt,
    y: copyCommand,
    H: openPreferred,
  }

  /**
   * Returns the hand-off action of a key, Shift+H only with Shift so Caps Lock h does nothing.
   * @param {KeyboardEvent} event - Keydown event
   * @returns {(() => unknown) | undefined} - Action, undefined for other keys or with the integration off
   */
  const handoffAction = (event: KeyboardEvent): (() => unknown) | undefined => {
    if (!mcp.enabled || (event.key === 'H' && !event.shiftKey)) {
      return undefined
    }

    return handoffKeys[event.key]
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

    const status = DECISION_KEYS[event.key]

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
