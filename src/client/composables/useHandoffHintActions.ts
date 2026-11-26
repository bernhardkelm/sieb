import { useHintActions } from '@/composables/useHintActions'
import { usePanelHandoff } from '@/composables/usePanelHandoff'

/**
 * Registers the hand-off hint actions: Open in Claude runs the default hand-off action as
 * Shift+H does, Copy for Claude copies the prompt of the panel finding as h does, Copy claude
 * command copies the command of an own image as y does. Open and the command stay blocked while
 * Claude cannot reach sieb, Copy for Claude does not.
 * @returns {void}
 */
export const useHandoffHintActions = (): void => {
  const {
    promptBlockedBy,
    openBlockedBy,
    commandBlockedBy,
    copyPrompt,
    copyCommand,
    openPreferred,
  } = usePanelHandoff()

  useHintActions({
    handoffOpen: {
      run: () => {
        openPreferred()
      },
      blockedBy: openBlockedBy,
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
      blockedBy: commandBlockedBy,
    },
  })
}
