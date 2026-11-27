import type { HandoffActions } from '@/composables/HandoffActions'
import { useClipboardCopy } from '@/composables/useClipboardCopy'
import { useHandoff, type Handoff } from '@/composables/useHandoff'
import { useHandoffOpen } from '@/composables/useHandoffOpen'
import { runCommandNote } from '@/format/handoffNotices'
import { NO_FINDING_REASON } from '@/format/handoffReasons'
import { openBlockReason } from '@/format/handoffTargets'
import { useFindingSeenStore } from '@/stores/findingSeenStore'
import { useHandoffTargetStore } from '@/stores/handoffTargetStore'
import { useMcpStore } from '@/stores/mcpStore'

export interface PanelHandoff extends HandoffActions {
  handoff: Handoff
}

/**
 * Hands the panel finding over to Claude for keys and hints, which have no button to show the
 * copied state, so a toast confirms each action. Deep links and the claude command need Claude
 * connected to sieb, copying the prompt does not. Each action marks the panel finding seen.
 * @returns {PanelHandoff} - Hand-off texts, block reasons, copy and open functions
 */
export const usePanelHandoff = (): PanelHandoff => {
  const handoff = useHandoff()
  const targets = useHandoffTargetStore()
  const mcp = useMcpStore()
  const seen = useFindingSeenStore()
  const { copyPrompt, open } = useHandoffOpen()
  const { copyWithNotice } = useClipboardCopy()

  /**
   * Returns why the prompt cannot be handed off.
   * @returns {string | null} - Reason, null while a finding is loaded
   */
  const promptBlockedBy = (): string | null =>
    handoff.prompts.value === null ? NO_FINDING_REASON : null

  /**
   * Returns why the default action cannot run, copying the prompt needs no connection.
   * @returns {string | null} - Reason, null while it can run
   */
  const openBlockedBy = (): string | null =>
    promptBlockedBy() ?? openBlockReason(targets.preferred, mcp.connectReason)

  /**
   * Returns why the claude command cannot be copied.
   * @returns {string | null} - Reason, null while it can be copied
   */
  const commandBlockedBy = (): string | null => handoff.commandBlockedBy.value ?? mcp.connectReason

  /**
   * Copies the claude command of an own image and confirms it with a toast.
   * @returns {Promise<boolean>} - Whether the command was copied
   */
  const copyCommand = async (): Promise<boolean> => {
    const command = handoff.command.value

    if (
      command === null ||
      commandBlockedBy() !== null ||
      !(await copyWithNotice(command, 'Copied claude command', runCommandNote(1)))
    ) {
      return false
    }

    seen.markShown()
    return true
  }

  /**
   * Copies the chat prompt and confirms it with a toast.
   * @returns {Promise<boolean>} - Whether the prompt was copied
   */
  const copyChatPrompt = async (): Promise<boolean> => {
    const copied = handoff.prompts.value !== null && (await copyPrompt(handoff.prompts.value.chat))

    if (copied) {
      seen.markShown()
    }

    return copied
  }

  /**
   * Opens the default client with its prompt, or copies the prompt when copy is the default.
   * @returns {boolean} - Whether the action ran
   */
  const openPreferred = (): boolean => {
    const prompts = handoff.prompts.value

    if (prompts === null || openBlockedBy() !== null) {
      return false
    }

    seen.markShown()
    open(targets.preferred, prompts)
    return true
  }

  return {
    handoff,
    promptBlockedBy,
    openBlockedBy,
    commandBlockedBy,
    copyPrompt: copyChatPrompt,
    copyCommand,
    openPreferred,
  }
}
