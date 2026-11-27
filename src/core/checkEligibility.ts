import type { CheckSkipReason } from '#core/check.ts'
import { sourceAccess, type SourceAccess } from '#core/sourceAccess.ts'

/** Lasting reasons a finding cannot be checked, in the order of CHECK_SKIP_REASONS */
export type CheckBlocker = Extract<CheckSkipReason, 'not_found' | 'resolved' | 'not_public'>

/** What decides whether a finding can be checked at all */
export interface CheckEligibilityFacts {
  resolved: boolean
  sourceAccess: SourceAccess
}

/**
 * Returns the first lasting reason a finding cannot be checked: unknown, then resolved, then an
 * image that is not public. Queue and claim on the server and the client's reason text share it,
 * so the same finding gets the same reason everywhere.
 * @param {CheckEligibilityFacts | null} facts - Resolution and source access, null for an unknown finding
 * @returns {CheckBlocker | null} - Reason, null when a check may run
 */
export const findingCheckBlocker = (facts: CheckEligibilityFacts | null): CheckBlocker | null => {
  if (facts === null) {
    return 'not_found'
  }

  if (facts.resolved) {
    return 'resolved'
  }

  return facts.sourceAccess === 'public' ? null : 'not_public'
}

/**
 * Derives the eligibility facts of a stored finding.
 * @param {{ resolvedAt: string | null; imageRef: string; owner: string | null } | null} finding - Finding, null when unknown
 * @param {readonly string[]} publicRegistries - Registries whose images count as public
 * @returns {CheckEligibilityFacts | null} - Facts, null for an unknown finding
 */
export const eligibilityFactsOf = (
  finding: { resolvedAt: string | null; imageRef: string; owner: string | null } | null,
  publicRegistries: readonly string[],
): CheckEligibilityFacts | null =>
  finding === null
    ? null
    : {
        resolved: finding.resolvedAt !== null,
        sourceAccess: sourceAccess(finding.imageRef, finding.owner, publicRegistries),
      }
