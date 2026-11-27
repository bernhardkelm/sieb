import type { InboxItem, InboxKind } from '#core/inbox/inboxItem.ts'
import { DAY_MS } from '#core/timeUnits.ts'
import { countOf } from '@/format/count'
import { shortImageName } from '@/format/imageName'

export const INBOX_KIND_LABELS: Record<InboxKind, string> = {
  proposal: 'Proposal',
  reopened: 'Re-opened',
  expiring: 'Expiring',
  kev: 'New KEV',
}

/**
 * Returns the whole days from now until a time, negative for the past.
 * @param {string} iso - ISO timestamp
 * @param {Date} now - Current time
 * @returns {number} - Days, rounded towards zero
 */
const daysUntil = (iso: string, now: Date): number =>
  Math.trunc((Date.parse(iso) - now.getTime()) / DAY_MS)

/**
 * Describes when an expiring decision runs out, such as "Expires in 5 days".
 * @param {string} expiresAt - Expiry
 * @param {Date} now - Current time
 * @returns {string} - Text
 */
export const expiresText = (expiresAt: string, now: Date): string => {
  const days = daysUntil(expiresAt, now)

  if (days <= 0) {
    return 'Expires today'
  }

  return days === 1 ? 'Expires tomorrow' : `Expires in ${countOf(days, 'day')}`
}

/**
 * Describes when a finding became KEV listed, such as "KEV listed 3 days ago".
 * @param {string} kevSince - Time sieb first saw the listing
 * @param {Date} now - Current time
 * @returns {string} - Text
 */
export const kevListedText = (kevSince: string, now: Date): string => {
  const days = -daysUntil(kevSince, now)

  if (days <= 0) {
    return 'KEV listed today'
  }

  return days === 1 ? 'KEV listed yesterday' : `KEV listed ${countOf(days, 'day')} ago`
}

/**
 * Describes the images an item covers: the image name, the image count of a proposal on
 * several, or every image.
 * @param {InboxItem} item - Item
 * @returns {string} - Text
 */
export const inboxScopeText = (item: InboxItem): string => {
  if (item.imageRef !== null) {
    return shortImageName(item.imageRef)
  }

  return item.kind === 'proposal' ? countOf(item.imageCount, 'image') : 'All images'
}
