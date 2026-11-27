import { computed, type ComputedRef } from 'vue'

import { HANDOFF_CLIENTS, handoffLink } from '#core/handoffLinks.ts'
import { listedFindings } from '#core/multiHandoffPrompt.ts'
import type { HandoffActions } from '@/composables/HandoffActions'
import { useClipboardCopy } from '@/composables/useClipboardCopy'
import { useHandoffOpen } from '@/composables/useHandoffOpen'
import type { BulkCount } from '@/format/bulkCount'
import {
  selectionCommandReason,
  selectionOpenReason,
  selectionPromptReason,
} from '@/format/selectionHandoffReasons'
import { CAPPED_REASON, copiedToast, openingTitle } from '@/format/selectionHandoffText'
import { useFindingSeenStore } from '@/stores/findingSeenStore'
import { useHandoffTargetStore } from '@/stores/handoffTargetStore'
import { useMcpStore } from '@/stores/mcpStore'
import { useSelectionStore } from '@/stores/selectionStore'

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
  const selection = useSelectionStore()
  const targets = useHandoffTargetStore()
  const seen = useFindingSeenStore()
  const mcp = useMcpStore()
  const { copyWithNotice } = useClipboardCopy()
  const { openLink } = useHandoffOpen()

  const texts = computed(() => selection.handoffTexts)

  /**
   * Marks the findings the hand-off lists as seen.
   * @returns {void}
   */
  const markListedSeen = (): void => {
    seen.markSeen(listedFindings(selection.findings).map((finding) => finding.id))
  }

  /**
   * Returns why the prompt cannot be handed off.
   * @returns {string | null} - Reason, null with checked rows
   */
  const promptBlockedBy = (): string | null => selectionPromptReason(texts.value)

  /**
   * Returns why the default action cannot run.
   * @returns {string | null} - Reason, null while it can run
   */
  const openBlockedBy = (): string | null =>
    selectionOpenReason(texts.value, targets.preferred, mcp.connectReason)

  /**
   * Returns why the claude command cannot be copied.
   * @returns {string | null} - Reason, null while it can be copied
   */
  const commandBlockedBy = (): string | null =>
    selectionCommandReason(texts.value, mcp.connectReason)

  /**
   * Copies the full prompt and names the copied findings in a toast.
   * @returns {Promise<boolean>} - Whether the prompt was copied
   */
  const copyPrompt = async (): Promise<boolean> => {
    const current = texts.value

    if (current === null) {
      return false
    }

    const { title, description } = copiedToast(current, 'prompt')

    if (!(await copyWithNotice(current.prompts.chat, title, description))) {
      return false
    }

    markListedSeen()
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

    const { title, description } = copiedToast(current, 'claude command')

    if (!(await copyWithNotice(current.command, title, description))) {
      return false
    }

    markListedSeen()
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
      markListedSeen()
      openLink(link, copyPrompt, openingTitle(current))
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
