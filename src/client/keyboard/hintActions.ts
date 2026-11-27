export type HintActionId =
  | 'accept'
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

export interface HintAction {
  /** Runs what the shortcut key runs */
  run: () => void
  /** Why the action has nothing to act on right now, null or absent while it can run */
  blockedBy?: () => string | null
}

export type HintActions = Partial<Record<HintActionId, HintAction>>

export const NOT_AVAILABLE_REASON = 'Not available in this view'
