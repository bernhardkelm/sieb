import type { BulkDecisionResult } from '#core/decisionApiTypes.ts'
import type { Decision } from '#core/decision.ts'
import type { FindingKey } from '#core/finding.ts'
import type { DecisionView } from '#core/findingView.ts'
import { createDecision, revokeDecision, updateDecision } from '@/api/decisionsApi'
import type { BulkTarget } from '@/components/decision/bulkTargets'
import type { DecisionFormValue } from '@/components/decision/decisionFormModel'
import { decisionPatch } from '@/components/decision/decisionPatch'
import { decisionRequest } from '@/components/decision/decisionRequests'
import { useBulkDecide } from '@/composables/useBulkDecide'
import { useDecisionSettle } from '@/composables/useDecisionSettle'
import { shortImageName } from '@/format/imageName'
import { STATUS_LABELS } from '@/format/labels'
import { notifySuccess } from '@/toast/toastManager'
import { rethrowWithNotice } from '@/toast/validationNotice'

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
 * Writes decisions through the API, applies created and changed ones to the findings at once, bumps
 * the data version so lists and the panel refetch, and confirms with a toast. A revoke waits for
 * the refetch, since another decision may still govern its findings. Validation errors are
 * rethrown for the form, other failures are toasted and rethrown.
 * @returns {DecisionCommands} - Commands
 */
export const useDecisionCommands = (): DecisionCommands => {
  const { settle } = useDecisionSettle()
  const bulkDecide = useBulkDecide()

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
          ? await createDecision(decisionRequest(finding, value))
          : await updateDecision(existing.id, decisionPatch(existing, value, new Date()))
      const where = value.scope === 'all' ? 'all images' : shortImageName(finding.imageRef)
      const kept = view.effective.state === 'reopened' ? ', still re-opened' : ''

      settle([view])
      notifySuccess(`${STATUS_LABELS[value.status]}: ${finding.vulnId}`, `For ${where}${kept}`)
      return view
    } catch (error) {
      return rethrowWithNotice('Decision not saved', error)
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
      return rethrowWithNotice('Decision not re-confirmed', error)
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
      return rethrowWithNotice('Decision not revoked', error)
    }
  }

  return { save, reconfirm, revoke, bulkDecide }
}
