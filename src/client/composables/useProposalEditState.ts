import { ref, type Ref } from 'vue'

export interface ProposalEditState {
  /** Whether the decision form of Edit & accept is open */
  editing: Ref<boolean>
  /** Whether the open form holds changes */
  editDirty: Ref<boolean>
  /** Failure of the last edited accept, shown in the form */
  editError: Ref<unknown>
  /** Opens the decision form prefilled with the proposed values */
  startEdit: () => void
  /** Closes the decision form and drops its draft */
  cancelEdit: () => void
}

/**
 * Holds the state of the Edit & accept form of the review panel.
 * @returns {ProposalEditState} - Form state and the open and cancel actions
 */
export const useProposalEditState = (): ProposalEditState => {
  const editing = ref(false)
  const editDirty = ref(false)
  const editError = ref<unknown>(null)

  /**
   * Opens the decision form with a fresh error state.
   * @returns {void}
   */
  const startEdit = (): void => {
    editError.value = null
    editing.value = true
  }

  /**
   * Closes the decision form and drops its draft and error.
   * @returns {void}
   */
  const cancelEdit = (): void => {
    editing.value = false
    editDirty.value = false
    editError.value = null
  }

  return { editing, editDirty, editError, startEdit, cancelEdit }
}
