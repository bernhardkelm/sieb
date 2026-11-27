import { computed, type ComputedRef } from 'vue'

import { useConnectionPoll } from '@/composables/useConnectionPoll'
import { useSelectionHandoff } from '@/composables/useSelectionHandoff'
import type { BulkCount } from '@/format/bulkCount'
import { HANDOFF_OPTIONS } from '@/format/handoffTargets'
import { useHandoffTargetStore } from '@/stores/handoffTargetStore'
import { runUnlessBlocked } from '@/toast/blockedNotice'

export type SelectionHandoffKind = 'open' | 'prompt' | 'command'

export interface SelectionHandoffButton {
  kind: SelectionHandoffKind
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
  press: (kind: SelectionHandoffKind) => void
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

  const buttons = computed<SelectionHandoffButton[]>(() => [
    ...(targets.preferred === 'copy'
      ? []
      : [
          {
            kind: 'open' as const,
            label: HANDOFF_OPTIONS[targets.preferred].action,
            template: HANDOFF_OPTIONS[targets.preferred].action.replace(' ', ' {n} '),
            shortcut: 'Shift+H',
            blockedBy: handoff.openBlockedBy(),
            count: handoff.count.value,
          },
        ]),
    {
      kind: 'prompt',
      label: 'Copy for Claude',
      template: 'Copy {n} for Claude',
      shortcut: 'h',
      blockedBy: handoff.promptBlockedBy(),
      count: handoff.count.value,
    },
    ...(handoff.hasCommand.value
      ? [
          {
            kind: 'command' as const,
            label: 'Copy claude command',
            template: 'Copy claude command for {n}',
            shortcut: 'y',
            blockedBy: handoff.commandBlockedBy(),
            count: handoff.count.value,
          },
        ]
      : []),
  ])

  const runners: Record<SelectionHandoffKind, () => unknown> = {
    open: handoff.openPreferred,
    prompt: handoff.copyPrompt,
    command: handoff.copyCommand,
  }

  /**
   * Runs the action of a button unless it is blocked.
   * @param {SelectionHandoffKind} kind - Button
   * @returns {void}
   */
  const press = (kind: SelectionHandoffKind): void => {
    const reason = buttons.value.find((button) => button.kind === kind)?.blockedBy ?? null

    runUnlessBlocked(reason, 'Not handed off', runners[kind])
  }

  return { buttons, press }
}
