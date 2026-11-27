import type { InboxItem, ProposalInboxItem } from '#core/inbox/inboxItem.ts'
import { isDecidableVerdict } from '#core/proposal.ts'
import { isSeeable } from '@/components/inbox/inboxItems'

export const NO_PROPOSALS = 'Only proposals can be accepted or rejected'
export const NONE_ACCEPTABLE = 'Outdated and inconclusive proposals need a review of their own'
export const NOTHING_TO_SEE = 'Only expiring decisions and new KEV listings can be marked as seen'

/** Why a bulk accept skips a proposal before sending it, as far as the Inbox knows */
export type AcceptSkip = 'inconclusive' | 'outdated'

export interface InboxBulkTargets {
  /** Checked proposals, the targets of accept and reject */
  proposals: ProposalInboxItem[]
  /** Checked proposals a bulk accept would accept */
  acceptable: ProposalInboxItem[]
  /** Checked expiring and KEV items, the targets of mark as seen */
  seeable: InboxItem[]
}

/**
 * Returns why a bulk accept skips a proposal: inconclusive never becomes a decision, an outdated
 * one has a governing decision that changed since it was filed and needs a review.
 * @param {ProposalInboxItem} item - Proposal item
 * @returns {AcceptSkip | null} - Reason, null for a proposal a bulk accept takes
 */
export const acceptSkipOf = (item: ProposalInboxItem): AcceptSkip | null => {
  if (!isDecidableVerdict(item.verdict)) {
    return 'inconclusive'
  }

  return item.outdated ? 'outdated' : null
}

/**
 * Splits the checked items by the bulk action that applies to them.
 * @param {readonly string[]} checked - Checked item keys in list order
 * @param {ReadonlyMap<string, InboxItem>} byKey - Listed items by key
 * @returns {InboxBulkTargets} - Targets per action
 */
export const bulkTargetsOf = (
  checked: readonly string[],
  byKey: ReadonlyMap<string, InboxItem>,
): InboxBulkTargets => {
  const items = checked.map((key) => byKey.get(key)).filter((item) => item !== undefined)
  const proposals = items.filter((item): item is ProposalInboxItem => item.kind === 'proposal')

  return {
    proposals,
    acceptable: proposals.filter((item) => acceptSkipOf(item) === null),
    seeable: items.filter(isSeeable),
  }
}

/**
 * Returns why the bulk accept cannot run on the checked items.
 * @param {InboxBulkTargets} targets - Checked items per action
 * @returns {string | null} - Reason, null while some checked proposal can be accepted
 */
export const acceptBlockedBy = (targets: InboxBulkTargets): string | null => {
  if (targets.proposals.length === 0) {
    return NO_PROPOSALS
  }

  return targets.acceptable.length === 0 ? NONE_ACCEPTABLE : null
}

/**
 * Returns why the bulk reject cannot run on the checked items.
 * @param {InboxBulkTargets} targets - Checked items per action
 * @returns {string | null} - Reason, null with a checked proposal
 */
export const rejectBlockedBy = (targets: InboxBulkTargets): string | null =>
  targets.proposals.length === 0 ? NO_PROPOSALS : null
