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
  payload: Record<string, unknown> // created: the decision, updated: field -> [before, after] or coveredImage
}

/**
 * Returns the image an updated event says an all-images decision started covering. sieb writes
 * such an event when it records the first baseline of an image under an all-scope decision.
 * @param {DecisionEvent} event - Event with its payload
 * @returns {string | null} - Image reference, null for any other event
 */
export const coveredImageOf = ({ type, payload }: DecisionEvent): string | null =>
  type === 'updated' && typeof payload.coveredImage === 'string' ? payload.coveredImage : null
