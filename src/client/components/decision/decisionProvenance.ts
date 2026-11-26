import type { DecisionEvent } from '#core/decisionEvent.ts'

const FIELD_LABELS: Record<string, string> = {
  status: 'status',
  justification: 'justification',
  reason: 'reason',
  expiresAt: 'expiry',
}

/**
 * Returns the string entries of an unknown list.
 * @param {unknown} value - Raw list
 * @returns {string[]} - Strings, empty for anything else
 */
const stringsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

/**
 * Describes where a decision change came from when an accepted proposal wrote it: who proposed
 * it through which client, who accepted it, and which fields the reviewer changed first.
 * @param {DecisionEvent} event - Created or updated event
 * @returns {string | null} - Such as "Proposed by alice via laptop, accepted by bob, edited: reason", null without provenance
 */
export const describeProvenance = (event: DecisionEvent): string | null => {
  const provenance = event.payload.provenance

  if (typeof provenance !== 'object' || provenance === null) {
    return null
  }

  const { proposedBy, clientLabel, editedFields } = provenance as Record<string, unknown>
  const edited = stringsOf(editedFields).map((field) => FIELD_LABELS[field] ?? field)
  const via = typeof clientLabel === 'string' && clientLabel !== '' ? ` via ${clientLabel}` : ''
  const line = `Proposed by ${String(proposedBy ?? 'Claude')}${via}, accepted by ${event.actor}`

  return edited.length > 0 ? `${line}, edited: ${edited.join(', ')}` : line
}
