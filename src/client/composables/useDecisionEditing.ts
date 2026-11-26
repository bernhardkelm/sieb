import { ref, type Ref } from 'vue'

import type { DecisionView } from '#core/findingView.ts'
import { useDecisionCommands } from '@/composables/useDecisionCommands'

export interface DecisionEditing {
  editOpen: Ref<boolean>
  editTarget: Ref<DecisionView | null>
  revokeOpen: Ref<boolean>
  revokeTarget: Ref<DecisionView | null>
  revoking: Ref<boolean>
  reconfirming: Ref<boolean>
  edit: (view: DecisionView) => void
  askRevoke: (view: DecisionView) => void
  confirmRevoke: (comment: string) => Promise<void>
  reconfirm: (view: DecisionView) => Promise<void>
}

/**
 * Holds the edit and revoke dialogs of a list of decisions and re-confirms re-opened ones;
 * revoked decisions open neither dialog.
 * @returns {DecisionEditing} - Dialog state and actions
 */
export const useDecisionEditing = (): DecisionEditing => {
  const commands = useDecisionCommands()

  const editOpen = ref(false)
  const editTarget = ref<DecisionView | null>(null)
  const revokeOpen = ref(false)
  const revokeTarget = ref<DecisionView | null>(null)
  const revoking = ref(false)
  const reconfirming = ref(false)

  /**
   * Opens the edit dialog of a decision that is not revoked.
   * @param {DecisionView} view - Decision
   * @returns {void}
   */
  const edit = (view: DecisionView): void => {
    if (view.decision.revokedAt === null) {
      editTarget.value = view
      editOpen.value = true
    }
  }

  /**
   * Asks to confirm revoking a decision that is not revoked yet.
   * @param {DecisionView} view - Decision
   * @returns {void}
   */
  const askRevoke = (view: DecisionView): void => {
    if (view.decision.revokedAt === null) {
      revokeTarget.value = view
      revokeOpen.value = true
    }
  }

  /**
   * Revokes the decision asked about; the dialog stays open after a failure.
   * @param {string} comment - Optional comment
   * @returns {Promise<void>} - Resolves when revoked or failed
   */
  const confirmRevoke = async (comment: string): Promise<void> => {
    if (!revokeTarget.value) {
      return
    }

    revoking.value = true

    try {
      await commands.revoke(revokeTarget.value.decision.id, comment)
      revokeOpen.value = false
    } catch {
      // failure toasted by the command, the dialog stays open for a retry
    } finally {
      revoking.value = false
    }
  }

  /**
   * Re-confirms a re-opened decision; other states and a running re-confirm are ignored.
   * @param {DecisionView} view - Decision
   * @returns {Promise<void>} - Resolves when re-confirmed or failed
   */
  const reconfirm = async (view: DecisionView): Promise<void> => {
    if (view.effective.state !== 'reopened' || reconfirming.value) {
      return
    }

    reconfirming.value = true

    try {
      await commands.reconfirm(view.decision)
    } catch {
      // failure toasted by the command
    } finally {
      reconfirming.value = false
    }
  }

  return {
    editOpen,
    editTarget,
    revokeOpen,
    revokeTarget,
    revoking,
    reconfirming,
    edit,
    askRevoke,
    confirmRevoke,
    reconfirm,
  }
}
