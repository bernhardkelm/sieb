import {
  SEEABLE_INBOX_KINDS,
  type InboxItem,
  type SeeableInboxKind,
} from '#core/inbox/inboxItem.ts'

const SEEABLE: readonly string[] = SEEABLE_INBOX_KINDS

/**
 * Returns whether the user can mark an item as seen, true for expiring decisions and KEV
 * listings; proposals and re-opened decisions leave the Inbox by being handled.
 * @param {InboxItem} item - Item
 * @returns {boolean} - True for expiring and kev items
 */
export const isSeeable = (item: InboxItem): item is InboxItem & { kind: SeeableInboxKind } =>
  SEEABLE.includes(item.kind)

/**
 * Returns the finding an item opens in the side panel.
 * @param {InboxItem} item - Item
 * @returns {number | null} - Finding id, null for proposals and decisions without open findings
 */
export const findingIdOfItem = (item: InboxItem): number | null =>
  item.kind === 'proposal' ? null : item.refs.findingId

/**
 * Returns the proposal an item opens in the review panel.
 * @param {InboxItem} item - Item
 * @returns {number | null} - Proposal id, null for the other kinds
 */
export const proposalIdOfItem = (item: InboxItem): number | null =>
  item.kind === 'proposal' ? item.refs.proposalId : null

/**
 * Returns the Inbox key of a proposal item.
 * @param {number} proposalId - Proposal id
 * @returns {string} - Item key
 */
export const proposalItemKey = (proposalId: number): string => `proposal:${proposalId}`
