import { coveredFacts } from '#core/inbox/inboxFacts.ts'
import type { InboxFinding, InboxProposal, ProposalInboxItem } from '#core/inbox/inboxItem.ts'
import { proposalKey } from '#core/inbox/inboxKeys.ts'
import { proposalReviewUrl } from '#core/inbox/inboxLinks.ts'

/**
 * Groups open findings by vuln_id.
 * @param {readonly InboxFinding[]} findings - Open findings
 * @returns {Map<string, InboxFinding[]>} - Findings per vuln_id
 */
const byVuln = (findings: readonly InboxFinding[]): Map<string, InboxFinding[]> => {
  const grouped = new Map<string, InboxFinding[]>()

  for (const finding of findings) {
    grouped.set(finding.vulnId, [...(grouped.get(finding.vulnId) ?? []), finding])
  }

  return grouped
}

/**
 * Builds one item per open proposal, with the facts of the open findings it targets: every
 * finding of its vuln_id for a proposal on all images, else those of its images.
 * @param {readonly InboxProposal[]} proposals - Open proposals
 * @param {readonly InboxFinding[]} findings - Open findings
 * @param {string} base - Link base from linkBase
 * @returns {ProposalInboxItem[]} - Items in proposal order
 */
export const proposalItems = (
  proposals: readonly InboxProposal[],
  findings: readonly InboxFinding[],
  base: string,
): ProposalInboxItem[] => {
  const grouped = byVuln(findings)

  return proposals.map((proposal) => {
    const images = proposal.imageRefs === null ? null : new Set(proposal.imageRefs)
    const covered = (grouped.get(proposal.vulnId) ?? []).filter(
      (finding) => images === null || images.has(finding.imageRef),
    )
    const facts = coveredFacts(covered, { severity: 'Unknown', kev: false })
    const single = proposal.imageRefs?.length === 1 ? proposal.imageRefs[0] : undefined

    return {
      kind: 'proposal',
      key: proposalKey(proposal.id),
      at: proposal.createdAt,
      vulnId: proposal.vulnId,
      imageRef: single ?? null,
      severity: facts.severity,
      kev: facts.kev,
      title: facts.title,
      url: proposalReviewUrl(base, proposal.id),
      refs: { proposalId: proposal.id },
      verdict: proposal.verdict,
      confidence: proposal.confidence,
      imageCount: covered.length,
    }
  })
}
