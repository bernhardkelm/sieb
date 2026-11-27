import type { BulkDecisionResult } from '#core/apiTypes.ts'
import type { Decision } from '#core/decision.ts'
import type { FindingKey } from '#core/finding.ts'
import type { DecisionView } from '#core/findingView.ts'
import { ApiError } from '@/api/ApiError'
import {
  createBulkDecisions,
  createDecision,
  revokeDecision,
  updateDecision,
} from '@/api/decisionsApi'
import { bulkSkipSummary } from '@/components/decision/bulkSkipSummary'
import type { BulkTarget } from '@/components/decision/bulkTargets'
import type { DecisionFormValue } from '@/components/decision/decisionFormModel'
import { decisionPatch } from '@/components/decision/decisionPatch'
import { countOf } from '@/format/count'
import { shortImageName } from '@/format/imageName'
import { STATUS_LABELS } from '@/format/labels'
import { useDataVersionStore } from '@/stores/dataVersionStore'
import { useFindingSeenStore } from '@/stores/findingSeenStore'
import { useFindingsStore } from '@/stores/findingsStore'
import { notifyError, notifySuccess } from '@/toast/toastManager'

export interface DecisionCommands {
  save: (
    finding: FindingKey,
    existing: Decision | null,
    value: DecisionFormValue,
  ) => Promise<DecisionView>
  reconfirm: (decision: Decision) => Promise<DecisionView>
  revoke: (decisionId: number, comment: string) => Promise<DecisionView>
  bulkDecide: (targets: BulkTarget[], value: DecisionFormValue) => Promise<BulkDecisionResult>
}

/**
 * Rethrows validation errors for the form to show and toasts every other failure first.
 * @param {string} title - Toast title
 * @param {unknown} error - Thrown value
 * @returns {never} - Always throws
 */
const fail = (title: string, error: unknown): never => {
  if (!(error instanceof ApiError && error.isValidation)) {
    notifyError(title, error)
  }

  throw error
}

/**
 * Writes decisions through the API, applies created and changed ones to the findings at once, bumps
 * the data version so lists and the panel refetch, and confirms with a toast. A revoke waits for
 * the refetch, since another decision may still govern its findings. Validation errors are
 * rethrown for the form, other failures are toasted and rethrown.
 * @returns {DecisionCommands} - Commands
 */
export const useDecisionCommands = (): DecisionCommands => {
  const findings = useFindingsStore()
  const dataVersion = useDataVersionStore()
  const seen = useFindingSeenStore()

  /**
   * Applies written decisions and announces the change.
   * @param {DecisionView[]} views - Written decisions
   * @returns {void}
   */
  const settle = (views: DecisionView[]): void => {
    for (const view of views) {
      if (view.effective.state !== 'revoked') {
        findings.applyDecision(view.decision, view.effective)
      }
    }

    dataVersion.bump()
  }

  /**
   * Marks the loaded findings a bulk decision created decisions for as seen.
   * @param {DecisionView[]} views - Created decisions
   * @returns {void}
   */
  const markDecidedSeen = (views: DecisionView[]): void => {
    const keys = new Set(views.map(({ decision }) => `${decision.vulnId}\n${decision.imageRef}`))

    seen.markSeen(
      findings.items
        .filter((finding) => keys.has(`${finding.vulnId}\n${finding.imageRef}`))
        .map((finding) => finding.id),
    )
  }

  /**
   * Creates a decision, or changes the existing one with only the fields that changed.
   * @param {FindingKey} finding - Decided vuln_id and image
   * @param {Decision | null} existing - Decision to change, null to create one
   * @param {DecisionFormValue} value - Form values
   * @returns {Promise<DecisionView>} - Written decision
   */
  const save = async (
    finding: FindingKey,
    existing: Decision | null,
    value: DecisionFormValue,
  ): Promise<DecisionView> => {
    try {
      const view =
        existing === null
          ? await createDecision({
              vulnId: finding.vulnId,
              scope: value.scope,
              imageRef: value.scope === 'image' ? finding.imageRef : null,
              status: value.status,
              justification: value.justification,
              reason: value.reason,
              expiresAt: value.expiresAt,
              upstreamPending: value.upstreamPending,
              waitingFor: value.waitingFor,
            })
          : await updateDecision(existing.id, decisionPatch(existing, value, new Date()))
      const where = value.scope === 'all' ? 'all images' : shortImageName(finding.imageRef)
      const kept = view.effective.state === 'reopened' ? ', still re-opened' : ''

      settle([view])
      notifySuccess(`${STATUS_LABELS[value.status]}: ${finding.vulnId}`, `For ${where}${kept}`)
      return view
    } catch (error) {
      return fail('Decision not saved', error)
    }
  }

  /**
   * Re-confirms a re-opened decision at the current findings, so it takes effect again.
   * @param {Decision} decision - Re-opened decision
   * @returns {Promise<DecisionView>} - Re-confirmed decision
   */
  const reconfirm = async (decision: Decision): Promise<DecisionView> => {
    try {
      const view = await updateDecision(decision.id, { reconfirm: true })

      settle([view])
      notifySuccess(`Re-confirmed: ${decision.vulnId}`, 'Back in effect at the current severity')
      return view
    } catch (error) {
      return fail('Decision not re-confirmed', error)
    }
  }

  /**
   * Revokes a decision, its findings return to Triage.
   * @param {number} decisionId - Decision id
   * @param {string} comment - Optional reason, blank for none
   * @returns {Promise<DecisionView>} - Revoked decision
   */
  const revoke = async (decisionId: number, comment: string): Promise<DecisionView> => {
    try {
      const view = await revokeDecision(decisionId, comment.trim() || undefined)

      settle([view])
      notifySuccess(`Revoked: ${view.decision.vulnId}`, 'Its findings are back in Triage')
      return view
    } catch (error) {
      return fail('Decision not revoked', error)
    }
  }

  /**
   * Creates image-scoped decisions for several CVEs, one request per CVE.
   * @param {BulkTarget[]} targets - CVEs with their images
   * @param {DecisionFormValue} value - Form values, scope ignored
   * @returns {Promise<BulkDecisionResult>} - Created decisions and skipped images of all CVEs
   */
  const bulkDecide = async (
    targets: BulkTarget[],
    value: DecisionFormValue,
  ): Promise<BulkDecisionResult> => {
    const total: BulkDecisionResult = { created: [], skipped: [] }

    try {
      for (const target of targets) {
        const result = await createBulkDecisions({
          vulnId: target.vulnId,
          imageRefs: target.imageRefs,
          status: value.status,
          justification: value.justification,
          reason: value.reason,
          expiresAt: value.expiresAt,
          upstreamPending: value.upstreamPending,
          waitingFor: value.waitingFor,
        })

        total.created.push(...result.created)
        total.skipped.push(...result.skipped)
      }
    } catch (error) {
      if (total.created.length > 0) {
        settle(total.created)
        markDecidedSeen(total.created)
      }

      return fail('Bulk decision incomplete', error)
    }

    settle(total.created)
    markDecidedSeen(total.created)
    notifySuccess(
      `${STATUS_LABELS[value.status]}: ${countOf(total.created.length, 'decision')}`,
      bulkSkipSummary(total.skipped),
    )
    return total
  }

  return { save, reconfirm, revoke, bulkDecide }
}
