import type { DecisionJustification, DecisionStatus } from '#core/decision.ts'
import { coveredImageOf, type DecisionEvent } from '#core/decisionEvent.ts'
import { describeProvenance } from '@/components/decision/decisionProvenance'
import { EVENT_LABELS, JUSTIFICATION_LABELS, REOPEN_LABELS, STATUS_LABELS } from '@/format/labels'
import { formatDate } from '@/format/relativeTime'
import { reopenText, triggerOfPayload } from '@/format/reopenText'

/** History entry as the panel lists it */
export interface EventSummary {
  title: string
  lines: string[]
  provenance?: string // accepted proposal behind a created or updated event
}

type Payload = Record<string, unknown>

/**
 * Returns a readable status label for a payload value.
 * @param {unknown} value - Raw status
 * @returns {string} - Label, the raw value for unknown statuses
 */
const statusLabel = (value: unknown): string =>
  STATUS_LABELS[value as DecisionStatus] ?? String(value)

/**
 * Returns a readable justification for a payload value.
 * @param {unknown} value - Raw justification or null
 * @returns {string} - Label, "none" for null, the raw value for unknown justifications
 */
const justificationLabel = (value: unknown): string =>
  value === null || value === undefined
    ? 'none'
    : (JUSTIFICATION_LABELS[value as DecisionJustification] ?? String(value))

/**
 * Returns a readable expiry for a payload value.
 * @param {unknown} value - ISO timestamp or null
 * @returns {string} - Date or "never"
 */
const expiryLabel = (value: unknown): string =>
  typeof value === 'string' ? formatDate(value) : 'never'

/**
 * Describes the changed fields of an updated event, field -> [before, after]. The reconfirm
 * flag and the cleared re-open timestamp are no field changes of their own.
 * @param {Payload} payload - Diff with the reconfirm flag
 * @returns {string[]} - One line per change
 */
const describeChanges = (payload: Payload): string[] => {
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
    } else if (field === 'kevAtDecision') {
      lines.push(after ? 'Confirmed while KEV listed' : 'Confirmed without KEV listing')
    }
  }

  return lines
}

/**
 * Summarises an updated event: a re-confirm, field changes, or neither.
 * @param {Payload} payload - Diff with the reconfirm flag, absent in old events
 * @returns {EventSummary} - Title and detail lines
 */
const describeUpdate = (payload: Payload): EventSummary => {
  const lines = describeChanges(payload)

  if (payload.reconfirm === true) {
    return { title: 'Re-confirmed', lines: lines.length > 0 ? lines : ['At the current findings'] }
  }

  if (lines.length > 0) {
    return { title: EVENT_LABELS.updated, lines }
  }

  return {
    title: EVENT_LABELS.updated,
    lines: [payload.reconfirm === false ? 'No field changed' : 'Confirmed without changes'],
  }
}

/**
 * Describes what re-opened a decision; old events carry only reason and severity.
 * @param {Payload} payload - Trigger of the re-open
 * @returns {string} - Explanation
 */
const describeReopen = (payload: Payload): string => {
  const trigger = triggerOfPayload(payload)

  if (trigger) {
    return reopenText(trigger)
  }

  return payload.reason === 'kev_listed'
    ? REOPEN_LABELS.kev_listed
    : `${REOPEN_LABELS.severity_rose} to ${String(payload.severity)}`
}

/**
 * Summarises a decision event by its type.
 * @param {DecisionEvent} event - Event with its payload
 * @returns {EventSummary} - Title and detail lines
 */
const summarize = (event: DecisionEvent): EventSummary => {
  const payload = event.payload
  const coveredImage = coveredImageOf(event)

  if (coveredImage !== null) {
    return { title: `Now covers ${coveredImage}`, lines: [] }
  }

  switch (event.type) {
    case 'created':
      return {
        title: `Decided ${statusLabel(payload.status)}`,
        lines: [
          ...(payload.justification
            ? [`Justification: ${justificationLabel(payload.justification)}`]
            : []),
          String(payload.reason ?? ''),
          `Expires ${expiryLabel(payload.expiresAt)}`,
        ],
      }
    case 'updated':
      return describeUpdate(payload)
    case 'revoked':
      return {
        title: EVENT_LABELS.revoked,
        lines: typeof payload.comment === 'string' ? [payload.comment] : [],
      }
    case 'expired':
      return { title: EVENT_LABELS.expired, lines: [`Expiry ${expiryLabel(payload.expiresAt)}`] }
    case 'reopened':
      return { title: EVENT_LABELS.reopened, lines: [describeReopen(payload)] }
  }

  return { title: String(event.type), lines: [] }
}

/**
 * Summarises a decision event for the history list, with the accepted proposal behind it.
 * @param {DecisionEvent} event - Event with its payload
 * @returns {EventSummary} - Title, detail lines and provenance
 */
export const describeEvent = (event: DecisionEvent): EventSummary => {
  const summary = summarize(event)
  const provenance = describeProvenance(event)

  return provenance === null ? summary : { ...summary, provenance }
}
