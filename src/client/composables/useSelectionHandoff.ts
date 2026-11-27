import { computed, type ComputedRef } from 'vue'

import { HANDOFF_CLIENTS, handoffLink } from '#core/handoffLinks.ts'
import { selectionHandoffTexts } from '#core/selectionHandoff.ts'
import { useClipboardCopy } from '@/composables/useClipboardCopy'
import { useHandoffOpen } from '@/composables/useHandoffOpen'
import type { HandoffActions } from '@/composables/usePanelHandoff'
import type { BulkCount } from '@/format/bulkCount'
import {
  CAPPED_REASON,
  NO_SELECTION_REASON,
  commandReason,
  copiedToast,
  linkReason,
} from '@/format/selectionHandoffText'
import { useHandoffSelectionStore } from '@/stores/handoffSelectionStore'
import { useHandoffTargetStore } from '@/stores/handoffTargetStore'
import { useMcpStore } from '@/stores/mcpStore'
import { notifySuccess } from '@/toast/toastManager'

export interface SelectionHandoff extends HandoffActions {
  /** Whether rows are checked, the hand-off then acts on them instead of the panel finding */
  active: ComputedRef<boolean>
  /** Whether the selection has a claude command, all own images of one repository */
  hasCommand: ComputedRef<boolean>
  /** Checked rows the prompt lists, at most the cap */
  count: ComputedRef<BulkCount>
}

/**
 * Hands the checked rows of the active list over to Claude: one prompt for all of them, copied
 * in full and carried by a deep link while it fits, a toast confirming each action. Deep links
 * and the claude command need Claude connected to sieb, copying the prompt does not.
 * @returns {SelectionHandoff} - Whether a selection exists, block reasons, copy and open functions
 */
export const useSelectionHandoff = (): SelectionHandoff => {
  const selection = useHandoffSelectionStore()
  const targets = useHandoffTargetStore()
  const mcp = useMcpStore()
  const { copy } = useClipboardCopy()
  const { openLink } = useHandoffOpen()

  const texts = computed(() => selectionHandoffTexts(selection.findings))

  /**
   * Returns why the prompt cannot be handed off.
   * @returns {string | null} - Reason, null with checked rows
   */
  const promptBlockedBy = (): string | null => (texts.value === null ? NO_SELECTION_REASON : null)

  /**
   * Returns why the default action cannot run: no selection, Claude not connected for a deep
   * link, or a selection too large for one.
   * @returns {string | null} - Reason, null while it can run
   */
  const openBlockedBy = (): string | null => {
    const preferred = targets.preferred

    if (texts.value === null || preferred === 'copy') {
      return promptBlockedBy()
    }

    return mcp.connectReason ?? linkReason(texts.value.links[HANDOFF_CLIENTS[preferred]])
  }

  /**
   * Returns why the claude command cannot be copied.
   * @returns {string | null} - Reason, null while it can be copied
   */
  const commandBlockedBy = (): string | null =>
    texts.value === null ? NO_SELECTION_REASON : (commandReason(texts.value) ?? mcp.connectReason)

  /**
   * Copies the full prompt and names the copied findings in a toast.
   * @returns {Promise<boolean>} - Whether the prompt was copied
   */
  const copyPrompt = async (): Promise<boolean> => {
    const current = texts.value

    if (current === null || !(await copy(current.prompts.chat))) {
      return false
    }

    const { title, description } = copiedToast(current, 'prompt')

    notifySuccess(title, description)
    return true
  }

  /**
   * Copies the claude command of own images of one repository.
   * @returns {Promise<boolean>} - Whether the command was copied
   */
  const copyCommand = async (): Promise<boolean> => {
    const current = texts.value

    if (current === null || current.command === null || commandBlockedBy() !== null) {
      return false
    }

    if (!(await copy(current.command))) {
      return false
    }

    const { title, description } = copiedToast(current, 'claude command')

    notifySuccess(title, description)
    return true
  }

  /**
   * Opens the default client with the link prompt, or copies the prompt when copy is the default.
   * @returns {boolean} - Whether the action ran
   */
  const openPreferred = (): boolean => {
    const current = texts.value
    const preferred = targets.preferred

    if (current === null || openBlockedBy() !== null) {
      return false
    }

    const prompt = preferred === 'copy' ? null : current.links[HANDOFF_CLIENTS[preferred]].prompt
    const link = preferred === 'copy' || prompt === null ? null : handoffLink(preferred, prompt)

    if (link === null) {
      void copyPrompt()
    } else {
      openLink(link, copyPrompt)
    }

    return true
  }

  return {
    active: computed(() => texts.value !== null),
    hasCommand: computed(() => texts.value !== null && texts.value.command !== null),
    count: computed(() => ({
      affected: texts.value?.listed ?? 0,
      selected: texts.value?.total ?? 0,
      skipped: [CAPPED_REASON],
    })),
    promptBlockedBy,
    openBlockedBy,
    commandBlockedBy,
    copyPrompt,
    copyCommand,
    openPreferred,
  }
}
