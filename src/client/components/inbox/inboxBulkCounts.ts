import {
  NO_PROPOSALS,
  NONE_ACCEPTABLE,
  NOTHING_TO_SEE,
  type InboxBulkTargets,
} from '@/components/inbox/inboxBulkTargets'
import type { BulkCount } from '@/format/bulkCount'

export interface InboxBulkCounts {
  accept: BulkCount
  reject: BulkCount
  markSeen: BulkCount
}

/**
 * Counts the checked items each bulk action of the Inbox acts on: accept the proposals a bulk
 * accept takes, reject every proposal, mark as seen the expiring and KEV items, each with the
 * reasons the other checked items are left out.
 * @param {InboxBulkTargets} targets - Checked items per action
 * @returns {InboxBulkCounts} - Count per action
 */
export const inboxBulkCounts = (targets: InboxBulkTargets): InboxBulkCounts => {
  const { selected, proposals, acceptable, seeable } = targets
  const otherKinds = proposals.length < selected ? [NO_PROPOSALS] : []

  return {
    accept: {
      affected: acceptable.length,
      selected,
      skipped: [...otherKinds, ...(acceptable.length < proposals.length ? [NONE_ACCEPTABLE] : [])],
    },
    reject: { affected: proposals.length, selected, skipped: otherKinds },
    markSeen: {
      affected: seeable.length,
      selected,
      skipped: seeable.length < selected ? [NOTHING_TO_SEE] : [],
    },
  }
}
