import type { BulkCount, BulkNoun } from '@/format/bulkCount'

export type HintActionId =
  | 'accept'
  | 'reject'
  | 'notAffected'
  | 'fixPlanned'
  | 'toggle'
  | 'selectAll'
  | 'search'
  | 'sync'
  | 'decideOpen'
  | 'decideAll'
  | 'openFinding'
  | 'edit'
  | 'revoke'
  | 'reconfirm'
  | 'handoffOpen'
  | 'handoff'
  | 'handoffCommand'
  | 'markSeen'
  | 'autoCheck'

/** Checked items an action acts on, for the count on its hint */
export interface HintBulk {
  count: BulkCount
  noun: BulkNoun
}

export interface HintAction {
  /** Runs what the shortcut key runs */
  run: () => void
  /** Why the action has nothing to act on right now, null or absent while it can run */
  blockedBy?: () => string | null
  /** Checked items the action acts on, null or absent while it acts on the cursor row */
  bulk?: () => HintBulk | null
}

export type HintActions = Partial<Record<HintActionId, HintAction>>

export const NOT_AVAILABLE_REASON = 'Not available in this view'
