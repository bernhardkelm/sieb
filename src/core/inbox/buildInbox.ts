import type { Decision } from '#core/decision.ts'
import { decisionItems } from '#core/inbox/decisionItems.ts'
import type { InboxCounts, InboxFinding, InboxItem, InboxProposal } from '#core/inbox/inboxItem.ts'
import { kevItems } from '#core/inbox/kevItems.ts'
import { proposalItems } from '#core/inbox/proposalItems.ts'
import { linkBase } from '#core/siebLinks.ts'
import { resolveTriage } from '#core/triage.ts'

export interface InboxSources {
  findings: readonly InboxFinding[] // open findings, resolved ones are ignored
  decisions: readonly Decision[] // revoked ones included
  proposals: readonly InboxProposal[] // open proposals
  seen: ReadonlyMap<string, string> // seen_at per item key of the user
  now: Date
  baseUrl: string // absolute origin for the item links
}

export interface Inbox {
  items: InboxItem[]
  counts: InboxCounts
}

/**
 * Returns whether the user marked an item as seen. An expiring key names the expiry, so a mark
 * always holds; a KEV mark holds only from the current listing on, so a CVE that leaves the
 * catalog and returns shows again.
 * @param {InboxItem} item - Item
 * @param {ReadonlyMap<string, string>} seen - seen_at per key
 * @returns {boolean} - True when the item is hidden
 */
const isSeen = (item: InboxItem, seen: ReadonlyMap<string, string>): boolean => {
  const seenAt = seen.get(item.key)

  if (seenAt === undefined) {
    return false
  }

  if (item.kind === 'expiring') {
    return true
  }

  return item.kind === 'kev' && Date.parse(seenAt) >= Date.parse(item.at)
}

/**
 * Compares items in Inbox order: events (proposals, re-opened decisions, new KEV listings)
 * newest first, then expiring decisions soonest first, the key breaking ties.
 * @param {InboxItem} a - First item
 * @param {InboxItem} b - Second item
 * @returns {number} - Negative when a sorts before b
 */
export const compareInboxItems = (a: InboxItem, b: InboxItem): number => {
  const aExpiring = a.kind === 'expiring'
  const bExpiring = b.kind === 'expiring'
  const byTime = aExpiring
    ? Date.parse(a.at) - Date.parse(b.at)
    : Date.parse(b.at) - Date.parse(a.at)

  return Number(aExpiring) - Number(bExpiring) || byTime || a.key.localeCompare(b.key)
}

/**
 * Counts items per kind.
 * @param {readonly InboxItem[]} items - Items
 * @returns {InboxCounts} - Count per kind and in total
 */
export const countInboxItems = (items: readonly InboxItem[]): InboxCounts => {
  const counts: InboxCounts = { proposal: 0, reopened: 0, expiring: 0, kev: 0, total: items.length }

  for (const item of items) {
    counts[item.kind] += 1
  }

  return counts
}

/**
 * Builds the Inbox of a user: open proposals, re-opened decisions, active decisions expiring
 * within 14 days and open findings KEV listed within the last 14 days, without the expiring and
 * KEV items the user marked as seen, in Inbox order.
 * @param {InboxSources} sources - Findings, decisions, proposals, seen marks, time and origin
 * @returns {Inbox} - Items and counts
 */
export const buildInbox = ({
  findings,
  decisions,
  proposals,
  seen,
  now,
  baseUrl,
}: InboxSources): Inbox => {
  const base = linkBase(baseUrl)
  const open = findings.filter((finding) => finding.resolvedAt === null)
  const triage = resolveTriage(open, decisions, now)
  const byId = new Map(open.map((finding) => [finding.id, finding]))
  const items = [
    ...proposalItems(proposals, open, base),
    ...decisionItems(triage.byDecision.values(), byId, now, base),
    ...kevItems(open, triage.byFinding, now, base),
  ]
    .filter((item) => !isSeen(item, seen))
    .sort(compareInboxItems)

  return { items, counts: countInboxItems(items) }
}
