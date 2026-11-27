import type { BulkDecisionRequest, DecisionRequest } from '#core/decisionApiTypes.ts'
import type { FindingKey } from '#core/finding.ts'
import type { BulkTarget } from '@/components/decision/bulkTargets'
import type { DecisionFormValue } from '@/components/decision/decisionFormModel'

/**
 * Builds the request that creates a decision for a finding from the form values.
 * @param {FindingKey} finding - Decided vuln_id and image
 * @param {DecisionFormValue} value - Form values
 * @returns {DecisionRequest} - Body of POST /api/decisions, the image only for image scope
 */
export const decisionRequest = (
  finding: FindingKey,
  value: DecisionFormValue,
): DecisionRequest => ({
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

/**
 * Builds the request that creates image-scoped decisions for one CVE from the form values.
 * @param {BulkTarget} target - CVE with its images
 * @param {DecisionFormValue} value - Form values, scope ignored
 * @returns {BulkDecisionRequest} - Body of POST /api/decisions/bulk
 */
export const bulkDecisionRequest = (
  target: BulkTarget,
  value: DecisionFormValue,
): BulkDecisionRequest => ({
  vulnId: target.vulnId,
  imageRefs: target.imageRefs,
  status: value.status,
  justification: value.justification,
  reason: value.reason,
  expiresAt: value.expiresAt,
  upstreamPending: value.upstreamPending,
  waitingFor: value.waitingFor,
})
