import type { CheckView } from '#core/check.ts'
import { findingCheckBlocker } from '#core/checkEligibility.ts'
import { MAX_OPEN_CHECKS } from '#core/checkLimits.ts'
import type { ImageOwnership, ImageVisibility } from '#core/imageVisibility.ts'
import type { ImageCheckAccess } from '#core/privateAccess.ts'
import { NO_ACCESS_REASON } from '@/format/accessText'
import { formatCount } from '@/format/count'

export const CHECKS_OFF_REASON = 'Auto-check is not switched on for this sieb.'
export const WORKER_OFFLINE_REASON = 'The Auto-check worker is offline, try again once it polls.'
export const NOT_PUBLIC_REASON =
  'Auto-check covers images it can pull anonymously or with a stored credential; use Claude Code in the repository.'
export const RESOLVED_REASON = 'The finding is resolved, nothing left to check.'
export const ALL_OPEN_REASON = 'Every selected finding already has an open check.'
export const OPEN_SKIP_REASON = 'Findings with an open check are skipped.'
export const COVERED_SKIP_REASON =
  'Findings an open proposal already covers as related findings are skipped.'

/**
 * Names the open proposal that already covers a finding as a related finding.
 * @param {number} proposalId - Covering proposal
 * @returns {string} - Reason text
 */
export const coveredReason = (proposalId: number): string =>
  `Already covered by proposal #${proposalId}, which lists this finding as related.`

export interface CheckAvailability {
  enabled: boolean
  workerOnline: boolean
}

export interface FindingCheckTarget extends CheckAvailability {
  visibility: ImageVisibility
  ownership: ImageOwnership
  resolved: boolean
  /** Queued or running check of the finding, null without one */
  open: CheckView | null
  /** How Auto-check reaches the images, absent from servers without private access */
  checkAccess?: ImageCheckAccess[]
  /** Open proposal that lists the finding in its relatedFindings, null or absent without one */
  coveredByProposal?: number | null
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
 * may come back any moment. Resolved goes before no access, in the order the server uses; the
 * visibility already counts an image a registry credential covers as reachable, and an own
 * image of unknown visibility stays queueable since the server probes it when queueing.
 * @param {FindingCheckTarget} target - Feature state and the finding facts
 * @returns {string | null} - Reason, null while a check can be queued
 */
export const findingCheckReason = (target: FindingCheckTarget): string | null => {
  if (!target.enabled) {
    return CHECKS_OFF_REASON
  }

  const blocker = findingCheckBlocker({
    resolved: target.resolved,
    visibility: target.visibility,
    ownership: target.ownership,
  })

  if (blocker !== null && blocker !== 'visibility_unknown') {
    if (blocker === 'resolved') {
      return RESOLVED_REASON
    }

    return target.checkAccess === undefined ? NOT_PUBLIC_REASON : NO_ACCESS_REASON
  }

  if (target.open !== null) {
    return target.open.state === 'running'
      ? 'Claude is checking this finding right now.'
      : `A check of this finding is already queued at #${target.open.position ?? '?'}.`
  }

  if (target.coveredByProposal !== undefined && target.coveredByProposal !== null) {
    return coveredReason(target.coveredByProposal)
  }

  return availabilityReason(target)
}

/**
 * Returns why the checked rows cannot be checked; images Auto-check cannot pull are skipped by the
 * server and named in the toast instead.
 * @param {CheckAvailability} availability - Feature and worker state
 * @param {number} withoutOpen - Checked findings without an open check
 * @returns {string | null} - Reason, null while some can be queued
 */
export const selectionCheckReason = (
  availability: CheckAvailability,
  withoutOpen: number,
): string | null => availabilityReason(availability) ?? (withoutOpen === 0 ? ALL_OPEN_REASON : null)

/**
 * Returns why the queue has no room for the checks of the checked rows. The server refuses to
 * hold more than MAX_OPEN_CHECKS queued and running checks, so the selection is queued whole or
 * not at all.
 * @param {number} open - Queued and running checks
 * @param {number} eligible - Checks the selection would queue
 * @param {number} max - Open checks the queue holds
 * @returns {string | null} - Reason, null while every check fits
 */
export const queueRoomReason = (
  open: number,
  eligible: number,
  max: number = MAX_OPEN_CHECKS,
): string | null => {
  const room = Math.max(0, max - open)

  if (eligible <= room) {
    return null
  }

  if (room === 0) {
    return `The queue is full (${formatCount(max)} open checks).`
  }

  return `The queue holds at most ${formatCount(max)} checks: ${formatCount(open)} ${open === 1 ? 'is' : 'are'} open, so at most ${formatCount(room)} more fit. Select fewer findings.`
}
