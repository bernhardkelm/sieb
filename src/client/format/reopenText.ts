import type { ReopenTrigger } from '#core/reopenTrigger.ts'
import { shortImageName } from '@/format/imageName'
import { REOPEN_LABELS } from '@/format/labels'

export const RECONFIRM_HINT =
  'Re-confirm to silence it again; saving other changes keeps it re-opened.'

/**
 * Explains what re-opened a decision against the baseline of the image that triggered it, such
 * as "Severity rose from Low to Critical on nginx".
 * @param {ReopenTrigger} trigger - Trigger of the re-open
 * @returns {string} - Explanation without a trailing period
 */
export const reopenText = (trigger: ReopenTrigger): string => {
  const image = shortImageName(trigger.imageRef)

  return trigger.reason === 'kev_listed'
    ? `${REOPEN_LABELS.kev_listed} on ${image}, not listed when decided`
    : `${REOPEN_LABELS.severity_rose} from ${trigger.baselineSeverity} to ${trigger.severity} on ${image}`
}

/**
 * Reads a re-open trigger from an event payload, which old events may lack in parts.
 * @param {Record<string, unknown>} payload - Payload of a reopened event
 * @returns {ReopenTrigger | null} - Trigger, null when the payload carries no image
 */
export const triggerOfPayload = (payload: Record<string, unknown>): ReopenTrigger | null =>
  typeof payload.imageRef === 'string' && typeof payload.reason === 'string'
    ? (payload as unknown as ReopenTrigger)
    : null
