import { isExpiring } from '#core/decisionFilter.ts'
import { coveredFacts } from '#core/inbox/inboxFacts.ts'
import type { ExpiringInboxItem, InboxFinding, ReopenedInboxItem } from '#core/inbox/inboxItem.ts'
import { expiringKey, reopenedKey } from '#core/inbox/inboxKeys.ts'
import { decisionUrl, findingUrl } from '#core/siebLinks.ts'
import type { DecisionTriage } from '#core/triage.ts'

/**
 * Collects the open findings a decision governs with their Inbox fields.
 * @param {DecisionTriage} entry - Evaluated decision
 * @param {ReadonlyMap<number, InboxFinding>} findings - Open findings by id
 * @returns {InboxFinding[]} - Governed open findings
 */
const governedOf = (
  entry: DecisionTriage,
  findings: ReadonlyMap<number, InboxFinding>,
): InboxFinding[] =>
  entry.openFindings.flatMap((finding) => {
    const full = findings.get(finding.id)

    return full ? [full] : []
  })

/**
 * Builds the Inbox items of the decisions: one per re-opened decision and one per active
 * decision expiring within the Inbox window. Rows link to the finding the re-open names, else
 * the most pressing governed finding, else to the decision itself.
 * @param {Iterable<DecisionTriage>} decisions - Evaluated decisions
 * @param {ReadonlyMap<number, InboxFinding>} findings - Open findings by id
 * @param {Date} now - Current time
 * @param {string} base - Link base from linkBase
 * @returns {(ReopenedInboxItem | ExpiringInboxItem)[]} - Items in decision order
 */
export const decisionItems = (
  decisions: Iterable<DecisionTriage>,
  findings: ReadonlyMap<number, InboxFinding>,
  now: Date,
  base: string,
): (ReopenedInboxItem | ExpiringInboxItem)[] => {
  const items: (ReopenedInboxItem | ExpiringInboxItem)[] = []

  for (const entry of decisions) {
    const { decision, effective } = entry
    const reopened = effective.state === 'reopened'

    if (!reopened && !isExpiring(entry, now)) {
      continue
    }

    const facts = coveredFacts(
      governedOf(entry, findings),
      { severity: decision.severityAtDecision, kev: decision.kevAtDecision },
      reopened ? effective.imageRef : decision.imageRef,
    )
    const shared = {
      vulnId: decision.vulnId,
      imageRef: decision.imageRef,
      severity: facts.severity,
      kev: facts.kev,
      title: facts.title,
      url: facts.lead
        ? findingUrl(base, facts.lead.id)
        : decisionUrl(base, decision.id, effective.state),
      refs: { decisionId: decision.id, findingId: facts.lead?.id ?? null },
      decisionStatus: decision.status,
    }

    if (reopened) {
      items.push({
        ...shared,
        kind: 'reopened',
        key: reopenedKey(decision.id, effective.reopenedAt),
        at: effective.reopenedAt ?? now.toISOString(),
        reopenReason: effective.reason,
      })
    } else if (decision.expiresAt !== null) {
      items.push({
        ...shared,
        kind: 'expiring',
        key: expiringKey(decision.id, decision.expiresAt),
        at: decision.expiresAt,
      })
    }
  }

  return items
}
