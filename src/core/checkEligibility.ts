import type { CheckSkipReason } from '#core/check.ts'
import {
  isCheckable,
  visibilityOf,
  ownershipOf,
  type ImageAccessSources,
  type ImageOwnership,
  type ImageVisibility,
} from '#core/imageVisibility.ts'

/** Reasons a finding cannot be checked, in the order of CHECK_SKIP_REASONS */
export type CheckBlocker = Extract<
  CheckSkipReason,
  'not_found' | 'resolved' | 'not_public' | 'visibility_unknown'
>

/** What decides whether a finding can be checked at all */
export interface CheckEligibilityFacts {
  resolved: boolean
  visibility: ImageVisibility
  ownership: ImageOwnership
}

/**
 * Returns the first reason a finding cannot be checked: unknown, then resolved, then an own image
 * whose visibility the pull probe has not told yet (visibility_unknown, a probe may still answer),
 * then an image that is neither public nor covered by a registry credential. Queue and claim on the
 * server and the client's reason text share it, so the same finding gets the same reason
 * everywhere.
 * @param {CheckEligibilityFacts | null} facts - Resolution, visibility and ownership, null for an unknown finding
 * @returns {CheckBlocker | null} - Reason, null when a check may run
 */
export const findingCheckBlocker = (facts: CheckEligibilityFacts | null): CheckBlocker | null => {
  if (facts === null) {
    return 'not_found'
  }

  if (facts.resolved) {
    return 'resolved'
  }

  if (isCheckable(facts.visibility)) {
    return null
  }

  return facts.visibility === 'unknown' && facts.ownership === 'own'
    ? 'visibility_unknown'
    : 'not_public'
}

/**
 * Derives the eligibility facts of a stored finding. An own image is checkable once the pull
 * probe saw it anonymously pullable or a registry credential covers it.
 * @param {{ resolvedAt: string | null; imageRef: string; owner: string | null } | null} finding - Finding, null when unknown
 * @param {ImageAccessSources} sources - Probe results, public registries and usable credentials
 * @returns {CheckEligibilityFacts | null} - Facts, null for an unknown finding
 */
export const eligibilityFactsOf = (
  finding: { resolvedAt: string | null; imageRef: string; owner: string | null } | null,
  sources: ImageAccessSources,
): CheckEligibilityFacts | null =>
  finding === null
    ? null
    : {
        resolved: finding.resolvedAt !== null,
        visibility: visibilityOf(finding, sources),
        ownership: ownershipOf(finding.owner),
      }
