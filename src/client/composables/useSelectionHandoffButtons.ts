import { computed, type ComputedRef } from 'vue'

import { useConnectionPoll } from '@/composables/useConnectionPoll'
import { useSelectionHandoff } from '@/composables/useSelectionHandoff'
import type { BulkCount } from '@/format/bulkCount'
import { HANDOFF_OPTIONS } from '@/format/handoffTargets'
import { HANDOFF_KEYS, type HandoffKey, type HandoffKind } from '@/keyboard/handoffKeymap'
import { useHandoffTargetStore } from '@/stores/handoffTargetStore'
import { runUnlessBlocked } from '@/toast/blockedNotice'

export interface SelectionHandoffButton {
  kind: HandoffKind
  label: string
  /** Label with `{n}` where the count of carried findings goes */
  template: string
  /** Key that runs the same action on the page */
  shortcut: string
  /** Why the action cannot run, null while it can */
  blockedBy: string | null
  /** Checked rows the hand-off carries */
  count: BulkCount
}

export interface SelectionHandoffButtons {
  buttons: ComputedRef<SelectionHandoffButton[]>
  /** Runs an action, or names why it cannot run in a toast, a tap shows no tooltip */
  press: (kind: HandoffKind) => void
}

/**
 * Describes the hand-off buttons of a selection bar: Open in the default client unless copying
 * is the default, Copy for Claude, and Copy claude command while every image is an own image of
 * one repository. While rows are checked and a deep link is the default action but Claude is not
 * connected yet, the connection state is polled slowly.
 * @returns {SelectionHandoffButtons} - Buttons and their press handler
 */
export const useSelectionHandoffButtons = (): SelectionHandoffButtons => {
  const handoff = useSelectionHandoff()
  const targets = useHandoffTargetStore()

  useConnectionPoll(() => handoff.active.value && targets.preferred !== 'copy')

  /**
   * Describes the button of a hand-off key.
   * @param {HandoffKey} key - Hand-off key
   * @param {string} label - Visible label
   * @param {string} template - Label with `{n}` for the count
   * @returns {SelectionHandoffButton} - Button
   */
  const buttonOf = (
    key: HandoffKey,
    label = key.label,
    template = key.template,
  ): SelectionHandoffButton => ({
    kind: key.kind,
    label,
    template,
    shortcut: key.shortcut,
    blockedBy: key.blockedBy(handoff),
    count: handoff.count.value,
  })

  const buttons = computed<SelectionHandoffButton[]>(() => {
    const preferred = targets.preferred === 'copy' ? null : HANDOFF_OPTIONS[targets.preferred]

    return [
      ...(preferred === null
        ? []
        : [buttonOf(HANDOFF_KEYS.open, preferred.action, preferred.action.replace(' ', ' {n} '))]),
      buttonOf(HANDOFF_KEYS.prompt),
      ...(handoff.hasCommand.value ? [buttonOf(HANDOFF_KEYS.command)] : []),
    ]
  })

  /**
   * Runs the action of a button unless it is blocked.
   * @param {HandoffKind} kind - Button
   * @returns {void}
   */
  const press = (kind: HandoffKind): void => {
    const reason = buttons.value.find((button) => button.kind === kind)?.blockedBy ?? null

    runUnlessBlocked(reason, 'Not handed off', () => HANDOFF_KEYS[kind].run(handoff))
  }

  return { buttons, press }
}
