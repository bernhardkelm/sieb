import type { InboxCounts, InboxItem } from '#core/inbox/inboxItem.ts'

/** Answer of GET /api/inbox: what waits for the acting user, in Inbox order */
export interface InboxResponse {
  items: InboxItem[]
  counts: InboxCounts
}

/** Body of POST /api/inbox/seen, only expiring and kev keys */
export interface InboxSeenRequest {
  keys: string[]
}

/** Answer of POST /api/inbox/seen: the counts after the marks */
export interface InboxSeenResponse {
  counts: InboxCounts
  ignored: string[] // valid keys not listed in the user's Inbox, not marked
}
