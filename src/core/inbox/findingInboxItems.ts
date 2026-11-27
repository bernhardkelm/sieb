import type { FindingView } from '#core/findingView.ts'
import type { InboxItem, InboxKind } from '#core/inbox/inboxItem.ts'

/** Finding fields that decide which Inbox items concern it */
export type InboxFindingTarget = Pick<FindingView, 'id' | 'vulnId' | 'imageRef'> & {
  decision: { id: number } | null // governing decision
}

/** Order in which a finding shows its Inbox items, the first one marks its row */
export const FINDING_INBOX_PRIORITY: readonly InboxKind[] = [
  'proposal',
  'reopened',
  'kev',
  'expiring',
]

/**
 * Returns whether an Inbox item concerns a finding: a proposal on its vulnerability that targets
 * its image or every image, a re-opened or expiring decision that governs it, which covers a
 * decision on every image, or the new KEV listing of the finding itself.
 * @param {InboxItem} item - Inbox item
 * @param {InboxFindingTarget} finding - Finding with its governing decision
 * @returns {boolean} - True when the item concerns the finding
 */
export const concernsFinding = (item: InboxItem, finding: InboxFindingTarget): boolean => {
  if (item.vulnId !== finding.vulnId) {
    return false
  }

  switch (item.kind) {
    case 'proposal':
      return item.imageRefs === null || item.imageRefs.includes(finding.imageRef)
    case 'kev':
      return item.refs.findingId === finding.id
    case 'reopened':
    case 'expiring':
      return finding.decision !== null && item.refs.decisionId === finding.decision.id
  }
}

/**
 * Picks the Inbox items that concern a finding, ordered by FINDING_INBOX_PRIORITY and within a
 * kind in Inbox order.
 * @param {readonly InboxItem[]} items - Inbox items in Inbox order
 * @param {InboxFindingTarget} finding - Finding with its governing decision
 * @returns {InboxItem[]} - Items of the finding, most relevant first
 */
export const inboxItemsForFinding = (
  items: readonly InboxItem[],
  finding: InboxFindingTarget,
): InboxItem[] =>
  items
    .filter((item) => concernsFinding(item, finding))
    .sort((a, b) => FINDING_INBOX_PRIORITY.indexOf(a.kind) - FINDING_INBOX_PRIORITY.indexOf(b.kind))
