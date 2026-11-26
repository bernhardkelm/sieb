import { useClipboardCopy } from '@/composables/useClipboardCopy'
import { useHandoff, NO_FINDING_REASON, type Handoff } from '@/composables/useHandoff'
import { useHandoffOpen } from '@/composables/useHandoffOpen'
import { useHandoffTargetStore } from '@/stores/handoffTargetStore'
import { notifySuccess } from '@/toast/toastManager'

export interface PanelHandoff {
  handoff: Handoff
  /** Why the prompt cannot be handed off, null while it can */
  promptBlockedBy: () => string | null
  copyPrompt: () => Promise<boolean>
  copyCommand: () => Promise<boolean>
  /** Runs the default hand-off action, false without a prompt */
  openPreferred: () => boolean
}

/**
 * Hands the panel finding over to Claude for keys and hints, which have no button to show the
 * copied state, so a toast confirms each action.
 * @returns {PanelHandoff} - Hand-off texts, block reason, copy and open functions
 */
export const usePanelHandoff = (): PanelHandoff => {
  const handoff = useHandoff()
  const targets = useHandoffTargetStore()
  const { copyPrompt, open } = useHandoffOpen()
  const { copy } = useClipboardCopy()

  /**
   * Copies the claude command of an own image and confirms it with a toast.
   * @returns {Promise<boolean>} - Whether the command was copied
   */
  const copyCommand = async (): Promise<boolean> => {
    const command = handoff.command.value

    if (command === null || !(await copy(command))) {
      return false
    }

    notifySuccess('Copied claude command', 'Run it in the repository that builds the image.')
    return true
  }

  /**
   * Opens the default client with the prompt, or copies it when copy is the default.
   * @returns {boolean} - Whether there was a prompt to hand off
   */
  const openPreferred = (): boolean => {
    const prompt = handoff.prompt.value

    if (prompt === null) {
      return false
    }

    open(targets.preferred, prompt)
    return true
  }

  return {
    handoff,
    promptBlockedBy: () => (handoff.prompt.value === null ? NO_FINDING_REASON : null),
    copyPrompt: async () => handoff.prompt.value !== null && copyPrompt(handoff.prompt.value),
    copyCommand,
    openPreferred,
  }
}
