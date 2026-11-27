import type { DecisionJustification, DecisionStatus } from '#core/decision.ts'
import { JUSTIFICATION_LABELS, STATUS_LABELS } from '@/format/labels'
import { formatDate } from '@/format/relativeTime'
import { UPSTREAM_PENDING_LABEL } from '@/format/upstreamText'

/** Payload of a decision event */
export type EventPayload = Record<string, unknown>

/**
 * Returns a readable status label for a payload value.
 * @param {unknown} value - Raw status
 * @returns {string} - Label, the raw value for unknown statuses
 */
export const statusLabel = (value: unknown): string =>
  STATUS_LABELS[value as DecisionStatus] ?? String(value)

/**
 * Returns a readable justification for a payload value.
 * @param {unknown} value - Raw justification or null
 * @returns {string} - Label, "none" for null, the raw value for unknown justifications
 */
export const justificationLabel = (value: unknown): string =>
  value === null || value === undefined
    ? 'none'
    : (JUSTIFICATION_LABELS[value as DecisionJustification] ?? String(value))

/**
 * Returns a readable expiry for a payload value.
 * @param {unknown} value - ISO timestamp or null
 * @returns {string} - Date or "never"
 */
export const expiryLabel = (value: unknown): string =>
  typeof value === 'string' ? formatDate(value) : 'never'

/**
 * Describes the changed fields of an updated event, field -> [before, after]. The reconfirm
 * flag and the cleared re-open timestamp are no field changes of their own.
 * @param {EventPayload} payload - Diff with the reconfirm flag
 * @returns {string[]} - One line per change
 */
export const describeChanges = (payload: EventPayload): string[] => {
  const lines: string[] = []

  for (const [field, change] of Object.entries(payload)) {
    const [before, after] = Array.isArray(change) ? change : [undefined, change]

    if (field === 'status') {
      lines.push(`Status ${statusLabel(before)} → ${statusLabel(after)}`)
    } else if (field === 'justification') {
      lines.push(`Justification ${justificationLabel(before)} → ${justificationLabel(after)}`)
    } else if (field === 'reason') {
      lines.push(`Reason: ${String(after)}`)
    } else if (field === 'expiresAt') {
      lines.push(`Expiry ${expiryLabel(before)} → ${expiryLabel(after)}`)
    } else if (field === 'severityAtDecision') {
      lines.push(`Confirmed at severity ${String(after)}`)
    } else if (field === 'upstreamPending') {
      lines.push(
        after ? UPSTREAM_PENDING_LABEL : `No longer ${UPSTREAM_PENDING_LABEL.toLowerCase()}`,
      )
    } else if (field === 'waitingFor' && typeof after === 'string') {
      lines.push(`Waiting for: ${after}`)
    } else if (field === 'kevAtDecision') {
      lines.push(after ? 'Confirmed while KEV listed' : 'Confirmed without KEV listing')
    }
  }

  return lines
}
