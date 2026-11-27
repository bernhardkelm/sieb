import { coveredImageOf, type DecisionEvent } from '#core/decisionEvent.ts'
import {
  describeChanges,
  expiryLabel,
  justificationLabel,
  statusLabel,
  type EventPayload,
} from '@/components/decision/decisionEventChanges'
import { describeProvenance } from '@/components/decision/decisionProvenance'
import { EVENT_LABELS, REOPEN_LABELS } from '@/format/labels'
import { reopenText, triggerOfPayload } from '@/format/reopenText'
import { waitingForText } from '@/format/upstreamText'

/** History entry as the panel lists it */
export interface EventSummary {
  title: string
  lines: string[]
  provenance?: string // accepted proposal behind a created or updated event
}

/**
 * Summarises an updated event: a re-confirm, field changes, or neither.
 * @param {EventPayload} payload - Diff with the reconfirm flag, absent in old events
 * @returns {EventSummary} - Title and detail lines
 */
const describeUpdate = (payload: EventPayload): EventSummary => {
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
 * @param {EventPayload} payload - Trigger of the re-open
 * @returns {string} - Explanation
 */
const describeReopen = (payload: EventPayload): string => {
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
          ...(payload.upstreamPending === true
            ? [waitingForText(typeof payload.waitingFor === 'string' ? payload.waitingFor : null)]
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
