import type { ProposalAcceptRequest, ProposalDetail } from '#core/proposalApiTypes.ts'
import { isDecidableVerdict } from '#core/proposal.ts'
import { ApiError } from '@/api/ApiError'
import { acceptProposal, rejectProposal } from '@/api/proposalsApi'
import { countOf } from '@/format/count'
import { STATUS_LABELS } from '@/format/labels'
import { useDataVersionStore } from '@/stores/dataVersionStore'
import { useFindingsStore } from '@/stores/findingsStore'
import { useProposalReviewStore } from '@/stores/proposalReviewStore'
import { notifyError, notifySuccess } from '@/toast/toastManager'
import { notifyUnlessValidation } from '@/toast/validationNotice'

/** How a proposal command ended, failed carries the thrown value for the form */
export type ProposalOutcome =
  | { kind: 'done' }
  | { kind: 'conflict' }
  | { kind: 'closed' }
  | { kind: 'failed'; error: unknown }

export interface ProposalCommands {
  accept: (
    detail: ProposalDetail,
    edits?: ProposalAcceptRequest['edits'],
  ) => Promise<ProposalOutcome>
  reject: (detail: ProposalDetail, reason: string) => Promise<ProposalOutcome>
}

/**
 * Returns whether a thrown value is a 409 answer with an error code.
 * @param {unknown} error - Thrown value
 * @param {string} code - Error code
 * @returns {boolean} - True for that conflict
 */
const isConflict = (error: unknown, code: string): boolean =>
  error instanceof ApiError && error.status === 409 && error.code === code

/**
 * Accepts and rejects proposals through the API. Success applies the written decisions to the
 * Triage list, bumps the data version and confirms with a toast. A proposal_conflict reloads the
 * detail and flags the conflict without accepting, a proposal_closed reloads and reports closed,
 * validation errors return for the form, other failures are toasted.
 * @returns {ProposalCommands} - Commands
 */
export const useProposalCommands = (): ProposalCommands => {
  const findings = useFindingsStore()
  const dataVersion = useDataVersionStore()
  const review = useProposalReviewStore()

  /**
   * Turns a failure into an outcome, reloading the detail for the two conflicts.
   * @param {string} title - Toast title of other failures
   * @param {unknown} error - Thrown value
   * @returns {Promise<ProposalOutcome>} - Outcome
   */
  const settleFailure = async (title: string, error: unknown): Promise<ProposalOutcome> => {
    if (isConflict(error, 'proposal_conflict')) {
      review.setConflict(true)
      await review.reload()
      return { kind: 'conflict' }
    }

    if (isConflict(error, 'proposal_closed')) {
      notifyError(title, error)
      dataVersion.bump()
      return { kind: 'closed' }
    }

    notifyUnlessValidation(title, error)
    return { kind: 'failed', error }
  }

  /**
   * Accepts a proposal with the decision ids the reviewer saw, not the ones of the latest reload,
   * optionally with edits.
   * @param {ProposalDetail} detail - Reviewed proposal
   * @param {ProposalAcceptRequest['edits']} edits - Changed decision fields, absent for none
   * @returns {Promise<ProposalOutcome>} - Outcome
   */
  const accept = async (
    detail: ProposalDetail,
    edits?: ProposalAcceptRequest['edits'],
  ): Promise<ProposalOutcome> => {
    const { proposal } = detail

    try {
      const result = await acceptProposal(proposal.id, {
        expectedDecisionIds: review.reviewedDecisionIds ?? detail.currentDecisionIds,
        ...(edits === undefined ? {} : { edits }),
      })
      const status = result.decisions[0]?.decision.status ?? detail.decisionValues?.status
      const where =
        proposal.scope === 'all' ? 'all images' : countOf(result.decisions.length, 'image')
      const edited = result.proposal.resolution === 'accepted_edited' ? ' with edits' : ''

      for (const view of result.decisions) {
        findings.applyDecision(view.decision, view.effective)
      }

      review.setConflict(false)
      dataVersion.bump()
      notifySuccess(
        status === undefined ? proposal.vulnId : `${STATUS_LABELS[status]}: ${proposal.vulnId}`,
        isDecidableVerdict(proposal.verdict)
          ? `Claude's proposal accepted${edited} for ${where}`
          : `Your decision saved for ${where}`,
      )
      return { kind: 'done' }
    } catch (error) {
      return settleFailure('Proposal not accepted', error)
    }
  }

  /**
   * Rejects a proposal with a reason that goes back to the proposer.
   * @param {ProposalDetail} detail - Reviewed proposal
   * @param {string} reason - Why the proposal is wrong
   * @returns {Promise<ProposalOutcome>} - Outcome
   */
  const reject = async (detail: ProposalDetail, reason: string): Promise<ProposalOutcome> => {
    try {
      await rejectProposal(detail.proposal.id, reason.trim())
      review.setConflict(false)
      dataVersion.bump()
      notifySuccess(
        `${isDecidableVerdict(detail.proposal.verdict) ? 'Rejected' : 'Dismissed'}: ${detail.proposal.vulnId}`,
        'Claude sees your reason',
      )
      return { kind: 'done' }
    } catch (error) {
      return settleFailure('Proposal not rejected', error)
    }
  }

  return { accept, reject }
}
