import { registryScopeFor, type AccessScope } from '#core/accessScope.ts'
import type { CheckSkipReason } from '#core/check.ts'
import { sourceAccess, type SourceAccess } from '#core/sourceAccess.ts'

/** Lasting reasons a finding cannot be checked, in the order of CHECK_SKIP_REASONS */
export type CheckBlocker = Extract<CheckSkipReason, 'not_found' | 'resolved' | 'not_public'>

/** What decides whether a finding can be checked at all */
export interface CheckEligibilityFacts {
  resolved: boolean
  sourceAccess: SourceAccess
  credentialAccess?: boolean // a stored registry credential covers the image, absent counts as false
}

/**
 * Returns the first lasting reason a finding cannot be checked: unknown, then resolved, then an
 * image that is neither public nor covered by a registry credential. Queue and claim on the
 * server and the client's reason text share it, so the same finding gets the same reason
 * everywhere.
 * @param {CheckEligibilityFacts | null} facts - Resolution, source access and credential coverage, null for an unknown finding
 * @returns {CheckBlocker | null} - Reason, null when a check may run
 */
export const findingCheckBlocker = (facts: CheckEligibilityFacts | null): CheckBlocker | null => {
  if (facts === null) {
    return 'not_found'
  }

  if (facts.resolved) {
    return 'resolved'
  }

  return facts.sourceAccess === 'public' || facts.credentialAccess === true ? null : 'not_public'
}

/**
 * Derives the eligibility facts of a stored finding. An own image (owner self) is checkable
 * too once a registry credential covers it.
 * @param {{ resolvedAt: string | null; imageRef: string; owner: string | null } | null} finding - Finding, null when unknown
 * @param {readonly string[]} publicRegistries - Registries whose images count as public
 * @param {readonly AccessScope[]} scopes - Usable credentials, empty while private access is off
 * @returns {CheckEligibilityFacts | null} - Facts, null for an unknown finding
 */
export const eligibilityFactsOf = (
  finding: { resolvedAt: string | null; imageRef: string; owner: string | null } | null,
  publicRegistries: readonly string[],
  scopes: readonly AccessScope[] = [],
): CheckEligibilityFacts | null =>
  finding === null
    ? null
    : {
        resolved: finding.resolvedAt !== null,
        sourceAccess: sourceAccess(finding.imageRef, finding.owner, publicRegistries),
        credentialAccess: registryScopeFor(scopes, finding.imageRef) !== null,
      }
