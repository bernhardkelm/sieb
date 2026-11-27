import type { DatabaseSync } from 'node:sqlite'

import { buildPendingIndex, type PendingIndex } from '#core/findingPending.ts'
import { buildInbox } from '#core/inbox/buildInbox.ts'
import { listOpenChecks } from '#server/db/checkRepository.ts'
import { listDecisions } from '#server/db/decisionRepository.ts'
import { listInboxFindings, readSeenMarks } from '#server/db/inboxRepository.ts'
import { listInboxProposals } from '#server/db/inboxProposals.ts'

/**
 * Reads what the pending filter needs: the Inbox of the acting user, without the items the user
 * marked as seen, and with Auto-check on the findings of the queued and running checks.
 * @param {DatabaseSync} db - Open database
 * @param {string | null} username - Acting user, null for an anonymous read without seen marks
 * @param {Date} now - Current time
 * @param {boolean} checksEnabled - Whether Auto-check is on
 * @returns {PendingIndex} - Index for the finding filter
 */
export const readPendingIndex = (
  db: DatabaseSync,
  username: string | null,
  now: Date,
  checksEnabled: boolean,
): PendingIndex => {
  const { items } = buildInbox({
    findings: listInboxFindings(db),
    decisions: listDecisions(db),
    proposals: listInboxProposals(db),
    seen: username === null ? new Map() : readSeenMarks(db, username),
    now,
    baseUrl: '', // item links are not read
  })

  return buildPendingIndex(
    items,
    checksEnabled ? listOpenChecks(db).map((check) => check.findingId) : null,
  )
}
