import { useClipboardCopy } from '@/composables/useClipboardCopy'
import { useHandoff, NO_FINDING_REASON, type Handoff } from '@/composables/useHandoff'
import { useHandoffOpen } from '@/composables/useHandoffOpen'
import { useFindingSeenStore } from '@/stores/findingSeenStore'
import { useHandoffTargetStore } from '@/stores/handoffTargetStore'
import { useMcpStore } from '@/stores/mcpStore'
import { notifySuccess } from '@/toast/toastManager'

/** Hand-off actions of the keys and hints, for the panel finding or the checked rows */
export interface HandoffActions {
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
  const { copy } = useClipboardCopy()

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

    seen.markShown()
    notifySuccess('Copied claude command', 'Run it in the repository that builds the image.')
    return true
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
    copyPrompt: async () => {
      const copied =
        handoff.prompts.value !== null && (await copyPrompt(handoff.prompts.value.chat))

      if (copied) {
        seen.markShown()
      }

      return copied
    },
    copyCommand,
    openPreferred,
  }
}
