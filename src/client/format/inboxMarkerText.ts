import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { expiresText, kevListedText } from '@/format/inboxText'
import { REOPEN_LABELS } from '@/format/labels'
import { VERDICT_LABELS } from '@/format/proposalLabels'

/**
 * Returns the short label of an Inbox item on a finding row, such as "Proposed · Not affected".
 * @param {InboxItem} item - Inbox item
 * @returns {string} - Label
 */
export const inboxMarkerLabel = (item: InboxItem): string => {
  switch (item.kind) {
    case 'proposal':
      return `Proposed · ${VERDICT_LABELS[item.verdict]}`
    case 'reopened':
      return 'Re-opened'
    case 'kev':
      return 'New KEV'
    case 'expiring':
      return 'Expires soon'
  }
}

/**
 * Describes what waits in the Inbox for a finding, such as "Decision re-opened: Severity rose".
 * @param {InboxItem} item - Inbox item
 * @param {Date} now - Current time
 * @returns {string} - Description without a trailing period
 */
export const inboxMarkerDetail = (item: InboxItem, now: Date): string => {
  switch (item.kind) {
    case 'proposal':
      return `Proposal waiting for review: ${VERDICT_LABELS[item.verdict]}`
    case 'reopened':
      return `Decision re-opened: ${REOPEN_LABELS[item.reopenReason]}`
    case 'kev':
      return kevListedText(item.at, now)
    case 'expiring':
      return `Decision ${expiresText(item.at, now).toLowerCase()}`
  }
}

/**
 * Returns the tooltip of a row marker: what waits and where the link leads.
 * @param {InboxItem} item - Inbox item
 * @param {Date} now - Current time
 * @returns {string} - Tooltip text
 */
export const inboxMarkerHint = (item: InboxItem, now: Date): string =>
  `${inboxMarkerDetail(item, now)}. ${item.kind === 'proposal' ? 'Opens the review in the Inbox.' : 'Opens it in the Inbox.'}`
