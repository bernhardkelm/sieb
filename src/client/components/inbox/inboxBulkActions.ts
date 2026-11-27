import type { InboxBulkCounts } from '@/components/inbox/inboxBulkCounts'
import type { BulkNoun } from '@/format/bulkCount'
import type { HintActionId } from '@/keyboard/hintActions'

export interface InboxBulkAction {
  id: HintActionId & keyof InboxBulkCounts
  label: string
  /** Noun of the items the action counts */
  noun: BulkNoun
}

export const PROPOSAL_NOUN: BulkNoun = { singular: 'proposal' }
export const ITEM_NOUN: BulkNoun = { singular: 'item' }

/** Accept and reject of the checked proposals */
export const DECIDE_ACTIONS: readonly InboxBulkAction[] = [
  { id: 'accept', label: 'Accept', noun: PROPOSAL_NOUN },
  { id: 'reject', label: 'Reject', noun: PROPOSAL_NOUN },
]

export const MARK_SEEN_ACTION: InboxBulkAction = {
  id: 'markSeen',
  label: 'Mark seen',
  noun: ITEM_NOUN,
}
