import { withinDaysBefore } from '#core/inbox/inboxFacts.ts'
import { INBOX_WINDOW_DAYS, type InboxFinding, type KevInboxItem } from '#core/inbox/inboxItem.ts'
import { kevKey } from '#core/inbox/inboxKeys.ts'
import { findingUrl } from '#core/siebLinks.ts'
import type { FindingTriage } from '#core/triage.ts'

/**
 * Builds one item per open finding that became KEV listed within the Inbox window, also when a
 * decision governs it.
 * @param {readonly InboxFinding[]} findings - Open findings
 * @param {ReadonlyMap<number, FindingTriage>} governing - Governing decision per finding id
 * @param {Date} now - Current time
 * @param {string} base - Link base from linkBase
 * @returns {KevInboxItem[]} - Items in finding order
 */
export const kevItems = (
  findings: readonly InboxFinding[],
  governing: ReadonlyMap<number, FindingTriage>,
  now: Date,
  base: string,
): KevInboxItem[] =>
  findings.flatMap((finding) => {
    const { kevSince } = finding

    if (
      !finding.kev ||
      kevSince === null ||
      finding.resolvedAt !== null ||
      !withinDaysBefore(kevSince, now, INBOX_WINDOW_DAYS)
    ) {
      return []
    }

    const decision = governing.get(finding.id)?.decision ?? null

    return [
      {
        kind: 'kev',
        key: kevKey(finding.id),
        at: kevSince,
        vulnId: finding.vulnId,
        imageRef: finding.imageRef,
        severity: finding.severity,
        kev: true,
        title: finding.title,
        url: findingUrl(base, finding.id),
        refs: { findingId: finding.id, decisionId: decision?.id ?? null },
        decisionStatus: decision?.status ?? null,
      },
    ]
  })
