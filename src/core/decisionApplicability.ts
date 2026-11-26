import type { Decision } from '#core/decision.ts'
import type { FindingKey } from '#core/finding.ts'

type ApplicabilityFields = Pick<Decision, 'vulnId' | 'scope' | 'imageRef' | 'revokedAt'>

/**
 * Returns whether a decision covers a finding: same vuln_id and either scope all or the same
 * image_ref. Ignores revocation, see selectApplicableDecision.
 * @param {ApplicabilityFields} decision - Decision
 * @param {FindingKey} finding - Finding key
 * @returns {boolean} - True when the decision covers the finding
 */
export const decisionCovers = (decision: ApplicabilityFields, finding: FindingKey): boolean =>
  decision.vulnId === finding.vulnId &&
  (decision.scope === 'all' || decision.imageRef === finding.imageRef)

/**
 * Selects the decision that governs a finding. Revoked decisions never apply, an image-scoped
 * decision wins over an all-scope one even when it is expired or re-opened, and among equal
 * candidates the newest one wins.
 * @param {readonly T[]} decisions - Candidate decisions, any vuln_id
 * @param {FindingKey} finding - Finding key
 * @returns {T | null} - Governing decision, null when none applies
 */
export const selectApplicableDecision = <T extends ApplicabilityFields & { id: number }>(
  decisions: readonly T[],
  finding: FindingKey,
): T | null => {
  let selected: T | null = null

  for (const decision of decisions) {
    if (decision.revokedAt !== null || !decisionCovers(decision, finding)) {
      continue
    }

    if (selected === null) {
      selected = decision
      continue
    }

    const moreSpecific = decision.scope === 'image' && selected.scope === 'all'
    const sameScopeNewer = decision.scope === selected.scope && decision.id > selected.id

    if (moreSpecific || sameScopeNewer) {
      selected = decision
    }
  }

  return selected
}

/**
 * Lists the findings a decision governs, open and resolved: those for which it is the
 * applicable decision among all decisions of its vuln_id.
 * @param {number} decisionId - Decision id, contained in decisions
 * @param {readonly (ApplicabilityFields & { id: number })[]} decisions - Decisions of the vuln_id
 * @param {readonly F[]} findings - Findings of the vuln_id
 * @returns {F[]} - Governed findings in input order
 */
export const governedFindings = <F extends FindingKey>(
  decisionId: number,
  decisions: readonly (ApplicabilityFields & { id: number })[],
  findings: readonly F[],
): F[] =>
  findings.filter((finding) => selectApplicableDecision(decisions, finding)?.id === decisionId)
