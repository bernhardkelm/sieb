import type { Decision } from '#core/decision.ts'
import { isExpired } from '#core/decisionExpiry.ts'
import { findReopenTrigger, type BaselineSubject, type ReopenTrigger } from '#core/reopenTrigger.ts'

export type ReopenReason = 'severity_rose' | 'kev_listed'

/** State of a decision at a point in time, with the detail that explains it */
export type EffectiveDecision =
  | { state: 'active' }
  | { state: 'fix_planned' }
  | { state: 'expired'; expiresAt: string }
  | { state: 'revoked'; revokedAt: string }
  | ({ state: 'reopened'; reopenedAt: string | null } & ReopenTrigger) // reopenedAt null: detected live, not yet latched by a sync

export type DecisionState = EffectiveDecision['state']

type EvaluatedFields = Pick<
  Decision,
  'status' | 'expiresAt' | 'revokedAt' | 'reopenedAt' | 'reopenTrigger' | 'baselines'
>

/**
 * Evaluates a decision at a point in time. Revocation wins over expiry, expiry over re-opening.
 * A decision is re-opened once a sync latched it, until a user re-confirms it, and also as soon
 * as a governed open finding ranks above its own baseline or became KEV listed, so the state is
 * correct between syncs.
 * @param {EvaluatedFields} decision - Decision
 * @param {readonly BaselineSubject[]} governed - Open findings the decision governs
 * @param {Date} now - Current time
 * @returns {EffectiveDecision} - State with its reason
 */
export const evaluateDecision = (
  decision: EvaluatedFields,
  governed: readonly BaselineSubject[],
  now: Date,
): EffectiveDecision => {
  if (decision.revokedAt !== null) {
    return { state: 'revoked', revokedAt: decision.revokedAt }
  }

  if (decision.expiresAt !== null && isExpired(decision.expiresAt, now)) {
    return { state: 'expired', expiresAt: decision.expiresAt }
  }

  if (decision.reopenedAt !== null && decision.reopenTrigger !== null) {
    return { state: 'reopened', reopenedAt: decision.reopenedAt, ...decision.reopenTrigger }
  }

  const trigger = findReopenTrigger(decision.baselines, governed)

  if (trigger !== null) {
    return { state: 'reopened', reopenedAt: null, ...trigger }
  }

  return decision.status === 'fix_planned' ? { state: 'fix_planned' } : { state: 'active' }
}

/**
 * Returns whether a decision state silences alerts.
 * @param {EffectiveDecision} effective - Evaluated decision
 * @returns {boolean} - True only for active not_affected and accepted decisions
 */
export const isSuppressing = (effective: EffectiveDecision): boolean => effective.state === 'active'

/**
 * Returns whether a decision state takes its findings out of the inbox.
 * @param {EffectiveDecision} effective - Evaluated decision
 * @returns {boolean} - True for active and fix_planned decisions
 */
export const leavesInbox = (effective: EffectiveDecision): boolean =>
  effective.state === 'active' || effective.state === 'fix_planned'
