import type { DatabaseSync } from 'node:sqlite'

import { buildInbox, type Inbox } from '#core/inbox/buildInbox.ts'
import { listDecisions } from '#server/db/decisionRepository.ts'
import { listInboxFindings, readSeenMarks } from '#server/db/inboxRepository.ts'
import { listInboxProposals } from '#server/db/inboxProposals.ts'

/**
 * Builds the Inbox of a user from the stored findings, decisions, open proposals and the
 * user's seen marks.
 * @param {DatabaseSync} db - Open database
 * @param {string} username - User whose seen marks apply
 * @param {Date} now - Current time
 * @param {string} baseUrl - Absolute origin for the item links
 * @returns {Inbox} - Items and counts
 */
export const readInbox = (
  db: DatabaseSync,
  username: string,
  now: Date,
  baseUrl: string,
): Inbox => {
  const decisions = listDecisions(db)

  return buildInbox({
    findings: listInboxFindings(db),
    decisions,
    proposals: listInboxProposals(db, decisions),
    seen: readSeenMarks(db, username),
    now,
    baseUrl,
  })
}
