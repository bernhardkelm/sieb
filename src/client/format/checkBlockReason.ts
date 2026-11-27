import type { CheckView } from '#core/check.ts'
import type { SourceAccess } from '#core/sourceAccess.ts'

export const CHECKS_OFF_REASON = 'Auto-check is not switched on for this sieb.'
export const WORKER_OFFLINE_REASON = 'The Auto-check worker is offline, try again once it polls.'
export const NOT_PUBLIC_REASON =
  'Auto-check covers public images only; use Claude Code in the repository.'
export const RESOLVED_REASON = 'The finding is resolved, nothing left to check.'
export const ALL_OPEN_REASON = 'Every selected finding already has an open check.'

export interface CheckAvailability {
  enabled: boolean
  workerOnline: boolean
}

export interface FindingCheckTarget extends CheckAvailability {
  sourceAccess: SourceAccess
  resolved: boolean
  /** Queued or running check of the finding, null without one */
  open: CheckView | null
}

/**
 * Returns why no check can be queued at all right now.
 * @param {CheckAvailability} availability - Feature and worker state
 * @returns {string | null} - Reason, null while checks can be queued
 */
export const availabilityReason = ({ enabled, workerOnline }: CheckAvailability): string | null => {
  if (!enabled) {
    return CHECKS_OFF_REASON
  }

  return workerOnline ? null : WORKER_OFFLINE_REASON
}

/**
 * Returns why the finding cannot be checked, lasting reasons before the offline worker, which
 * may come back any moment.
 * @param {FindingCheckTarget} target - Feature state and the finding facts
 * @returns {string | null} - Reason, null while a check can be queued
 */
export const findingCheckReason = (target: FindingCheckTarget): string | null => {
  if (!target.enabled) {
    return CHECKS_OFF_REASON
  }

  if (target.sourceAccess !== 'public') {
    return NOT_PUBLIC_REASON
  }

  if (target.resolved) {
    return RESOLVED_REASON
  }

  if (target.open !== null) {
    return target.open.state === 'running'
      ? 'Claude is checking this finding right now.'
      : `A check of this finding is already queued at #${target.open.position ?? '?'}.`
  }

  return availabilityReason(target)
}

/**
 * Returns why the checked rows cannot be checked; private images among them are skipped by the
 * server and named in the toast instead.
 * @param {CheckAvailability} availability - Feature and worker state
 * @param {number} withoutOpen - Checked findings without an open check
 * @returns {string | null} - Reason, null while some can be queued
 */
export const selectionCheckReason = (
  availability: CheckAvailability,
  withoutOpen: number,
): string | null => availabilityReason(availability) ?? (withoutOpen === 0 ? ALL_OPEN_REASON : null)
