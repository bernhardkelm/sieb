import type {
  BulkDecisionRequest,
  BulkDecisionResult,
  DecisionPatchRequest,
  DecisionRequest,
} from '#core/apiTypes.ts'
import type { DecisionFilter } from '#core/decisionFilter.ts'
import type { DecisionView } from '#core/findingView.ts'
import { apiRequest } from '@/api/apiRequest'
import { queryString } from '@/api/queryString'

export const DECISIONS_URL = '/api/decisions'

/**
 * Fetches decisions with their state, newest first.
 * @param {DecisionFilter} state - Only decisions in this state, or active ones expiring soon
 * @returns {Promise<DecisionView[]>} - Decisions
 */
export const fetchDecisions = (state?: DecisionFilter): Promise<DecisionView[]> =>
  apiRequest(`${DECISIONS_URL}${queryString({ state })}`)

/**
 * Creates an image-scoped or all-scope decision.
 * @param {DecisionRequest} input - Decision fields, expiresAt omitted for the status default
 * @returns {Promise<DecisionView>} - Stored decision with its state
 * @throws {ApiError} - 400 with validation errors, 409 when a decision already exists
 */
export const createDecision = (input: DecisionRequest): Promise<DecisionView> =>
  apiRequest(DECISIONS_URL, 'POST', input)

/**
 * Changes status, reason or expiry of a decision, or re-confirms a re-opened one.
 * @param {number} id - Decision id
 * @param {DecisionPatchRequest} patch - Changed fields, reconfirm true to put it back in effect
 * @returns {Promise<DecisionView>} - Changed decision with its state
 * @throws {ApiError} - 400 with validation errors, 404 unknown, 409 revoked
 */
export const updateDecision = (id: number, patch: DecisionPatchRequest): Promise<DecisionView> =>
  apiRequest(`${DECISIONS_URL}/${id}`, 'PATCH', patch)

/**
 * Revokes a decision, its findings return to Triage.
 * @param {number} id - Decision id
 * @param {string} comment - Optional reason for the revocation
 * @returns {Promise<DecisionView>} - Revoked decision
 * @throws {ApiError} - 404 unknown, 409 already revoked
 */
export const revokeDecision = (id: number, comment?: string): Promise<DecisionView> =>
  apiRequest(`${DECISIONS_URL}/${id}/revoke`, 'POST', comment ? { comment } : {})

/**
 * Creates image-scoped decisions of one CVE for several images or all open ones.
 * @param {BulkDecisionRequest} input - Shared decision fields and the target images
 * @returns {Promise<BulkDecisionResult>} - Created decisions and skipped images
 * @throws {ApiError} - 400 with validation errors
 */
export const createBulkDecisions = (input: BulkDecisionRequest): Promise<BulkDecisionResult> =>
  apiRequest(`${DECISIONS_URL}/bulk`, 'POST', input)
