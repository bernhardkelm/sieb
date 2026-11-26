import { useClipboardCopy } from '@/composables/useClipboardCopy'
import { useHandoff, NO_FINDING_REASON, type Handoff } from '@/composables/useHandoff'
import { useHandoffOpen } from '@/composables/useHandoffOpen'
import { useHandoffTargetStore } from '@/stores/handoffTargetStore'
import { useMcpStore } from '@/stores/mcpStore'
import { notifySuccess } from '@/toast/toastManager'

export interface PanelHandoff {
  handoff: Handoff
  /** Why the prompt cannot be handed off, null while it can */
  promptBlockedBy: () => string | null
  /** Why the default action cannot run: no prompt, or a deep link while Claude cannot reach sieb */
  openBlockedBy: () => string | null
  /** Why the claude command cannot be copied: none, or Claude cannot reach sieb */
  commandBlockedBy: () => string | null
  copyPrompt: () => Promise<boolean>
  copyCommand: () => Promise<boolean>
  /** Runs the default hand-off action, false while it is blocked */
  openPreferred: () => boolean
}

/**
 * Hands the panel finding over to Claude for keys and hints, which have no button to show the
 * copied state, so a toast confirms each action. Deep links and the claude command need Claude
 * connected to sieb, copying the prompt does not.
 * @returns {PanelHandoff} - Hand-off texts, block reasons, copy and open functions
 */
export const usePanelHandoff = (): PanelHandoff => {
  const handoff = useHandoff()
  const targets = useHandoffTargetStore()
  const mcp = useMcpStore()
  const { copyPrompt, open } = useHandoffOpen()
  const { copy } = useClipboardCopy()

  /**
   * Returns why the prompt cannot be handed off.
   * @returns {string | null} - Reason, null while a finding is loaded
   */
  const promptBlockedBy = (): string | null =>
    handoff.prompt.value === null ? NO_FINDING_REASON : null

  /**
   * Returns why the default action cannot run, copying the prompt needs no connection.
   * @returns {string | null} - Reason, null while it can run
   */
  const openBlockedBy = (): string | null =>
    promptBlockedBy() ?? (targets.preferred === 'copy' ? null : mcp.connectReason)

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

    if (command === null || commandBlockedBy() !== null || !(await copy(command))) {
      return false
    }

    notifySuccess('Copied claude command', 'Run it in the repository that builds the image.')
    return true
  }

  /**
   * Opens the default client with the prompt, or copies it when copy is the default.
   * @returns {boolean} - Whether the action ran
   */
  const openPreferred = (): boolean => {
    const prompt = handoff.prompt.value

    if (prompt === null || openBlockedBy() !== null) {
      return false
    }

    open(targets.preferred, prompt)
    return true
  }

  return {
    handoff,
    promptBlockedBy,
    openBlockedBy,
    commandBlockedBy,
    copyPrompt: async () => handoff.prompt.value !== null && copyPrompt(handoff.prompt.value),
    copyCommand,
    openPreferred,
  }
}
