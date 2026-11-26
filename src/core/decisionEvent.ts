export const DECISION_EVENT_TYPES = [
  'created',
  'updated',
  'revoked',
  'expired',
  'reopened',
] as const

export type DecisionEventType = (typeof DECISION_EVENT_TYPES)[number]

/** Actor of events sieb writes by itself during a sync */
export const SYSTEM_ACTOR = 'sieb'

/** Append-only history entry of a decision */
export interface DecisionEvent {
  id: number
  decisionId: number
  type: DecisionEventType
  actor: string
  at: string
  payload: Record<string, unknown> // created: the decision, updated: field -> [before, after]
}
