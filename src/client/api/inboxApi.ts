import type { InboxResponse, InboxSeenRequest, InboxSeenResponse } from '#core/inboxApiTypes.ts'
import { apiRequest } from '@/api/apiRequest'

export const INBOX_URL = '/api/inbox'

/**
 * Fetches what waits for the acting user, in Inbox order.
 * @returns {Promise<InboxResponse>} - Items and their counts per kind
 */
export const fetchInbox = (): Promise<InboxResponse> => apiRequest(INBOX_URL)

/**
 * Marks expiring and KEV items as seen for the acting user.
 * @param {string[]} keys - Item keys, only expiring and kev keys
 * @returns {Promise<InboxSeenResponse>} - Counts after the marks
 */
export const markInboxSeen = (keys: string[]): Promise<InboxSeenResponse> =>
  apiRequest(`${INBOX_URL}/seen`, 'POST', { keys } satisfies InboxSeenRequest)
