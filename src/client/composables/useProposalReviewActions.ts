import { ref, type Ref } from 'vue'

import { isDecidableVerdict } from '#core/proposal.ts'

import type { DecisionFormValue } from '@/components/decision/decisionFormModel'
import { acceptEdits, formErrorOfAccept } from '@/components/proposals/acceptEdits'
import { useProposalCommands, type ProposalOutcome } from '@/composables/useProposalCommands'
import { useProposalReviewStore } from '@/stores/proposalReviewStore'

export interface ProposalReviewActions {
  busy: Ref<boolean>
  editing: Ref<boolean>
  editDirty: Ref<boolean>
  editError: Ref<unknown>
  rejecting: Ref<boolean>
  rejectError: Ref<unknown>
  accept: () => Promise<void>
  acceptEdited: (value: DecisionFormValue) => Promise<void>
  reject: (reason: string) => Promise<void>
  startEdit: () => void
  cancelEdit: () => void
}

/**
 * Runs the actions of the review panel on the proposal in the review store: Accept,
 * Edit & accept and Reject, for an inconclusive one Decide myself and Dismiss, one at a time and never again on a proposal one of them finished.
 * Both accepts wait while the decisions changed since the reviewer saw them, until Review again.
 * A finished command reports resolved, a proposal that closed in the meantime reports closed, a
 * conflict leaves the panel open on the reloaded detail, and validation errors stay with the
 * form or dialog that caused them.
 * @param {(outcome: 'resolved' | 'closed') => void} onFinish - Called when the panel should leave
 * @returns {ProposalReviewActions} - State and handlers
 */
export const useProposalReviewActions = (
  onFinish: (outcome: 'resolved' | 'closed') => void,
): ProposalReviewActions => {
  const review = useProposalReviewStore()
  const commands = useProposalCommands()
  const busy = ref(false)
  const editing = ref(false)
  const editDirty = ref(false)
  const editError = ref<unknown>(null)
  const rejecting = ref(false)
  const rejectError = ref<unknown>(null)
  let finishedId: number | null = null

  /**
   * Runs a command unless another runs, no open proposal is loaded, a command already finished
   * this proposal, or an accept meets an unacknowledged conflict, and reports its end.
   * @param {(detail: NonNullable<typeof review.detail>) => Promise<ProposalOutcome>} command - Command
   * @param {boolean} accepting - Whether the command writes decisions
   * @returns {Promise<ProposalOutcome | null>} - Outcome, null when nothing ran
   */
  const run = async (
    command: (detail: NonNullable<typeof review.detail>) => Promise<ProposalOutcome>,
    accepting: boolean,
  ): Promise<ProposalOutcome | null> => {
    const detail = review.detail

    if (
      busy.value ||
      detail === null ||
      detail.proposal.state !== 'open' ||
      detail.proposal.id === finishedId ||
      (accepting && review.conflict)
    ) {
      return null
    }

    busy.value = true

    try {
      const outcome = await command(detail)

      if (outcome.kind === 'done' || outcome.kind === 'closed') {
        finishedId = detail.proposal.id
        editing.value = false
        editDirty.value = false
        rejecting.value = false
        onFinish(outcome.kind === 'done' ? 'resolved' : 'closed')
      }

      return outcome
    } finally {
      busy.value = false
    }
  }

  /**
   * Accepts the proposal as proposed, never an inconclusive one, which only Decide myself settles.
   * @returns {Promise<void>} - Resolves when the command ended
   */
  const accept = async (): Promise<void> => {
    if (review.detail !== null && !isDecidableVerdict(review.detail.proposal.verdict)) {
      return
    }

    await run((detail) => commands.accept(detail), true)
  }

  /**
   * Accepts the proposal with the fields changed in the decision form.
   * @param {DecisionFormValue} value - Submitted form values
   * @returns {Promise<void>} - Resolves when the command ended
   */
  const acceptEdited = async (value: DecisionFormValue): Promise<void> => {
    editError.value = null

    const outcome = await run(
      (detail) => commands.accept(detail, acceptEdits(detail.decisionValues, value)),
      true,
    )

    if (outcome?.kind === 'failed') {
      editError.value = formErrorOfAccept(outcome.error)
    }
  }

  /**
   * Rejects the proposal with a reason.
   * @param {string} reason - Reason for the proposer
   * @returns {Promise<void>} - Resolves when the command ended
   */
  const reject = async (reason: string): Promise<void> => {
    rejectError.value = null

    const outcome = await run((detail) => commands.reject(detail, reason), false)

    if (outcome?.kind === 'failed') {
      rejectError.value = outcome.error
    }
  }

  /**
   * Opens the decision form prefilled with the proposed values.
   * @returns {void}
   */
  const startEdit = (): void => {
    editError.value = null
    editing.value = true
  }

  /**
   * Closes the decision form and drops its draft.
   * @returns {void}
   */
  const cancelEdit = (): void => {
    editing.value = false
    editDirty.value = false
    editError.value = null
  }

  return {
    busy,
    editing,
    editDirty,
    editError,
    rejecting,
    rejectError,
    accept,
    acceptEdited,
    reject,
    startEdit,
    cancelEdit,
  }
}
