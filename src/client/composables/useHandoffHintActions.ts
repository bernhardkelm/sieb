import { useHintActions } from '@/composables/useHintActions'
import { usePanelHandoff } from '@/composables/usePanelHandoff'

/**
 * Registers the hand-off hint actions: Open in Claude runs the default hand-off action as
 * Shift+H does, Copy for Claude copies the prompt of the panel finding as h does, Copy claude
 * command copies the command of an own image as y does.
 * @returns {void}
 */
export const useHandoffHintActions = (): void => {
  const { handoff, promptBlockedBy, copyPrompt, copyCommand, openPreferred } = usePanelHandoff()

  useHintActions({
    handoffOpen: {
      run: () => {
        openPreferred()
      },
      blockedBy: promptBlockedBy,
    },
    handoff: {
      run: () => {
        void copyPrompt()
      },
      blockedBy: promptBlockedBy,
    },
    handoffCommand: {
      run: () => {
        void copyCommand()
      },
      blockedBy: () => handoff.commandBlockedBy.value,
    },
  })
}
