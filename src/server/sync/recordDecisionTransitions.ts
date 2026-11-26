import type { DatabaseSync } from 'node:sqlite'

import type { Decision } from '#core/decision.ts'
import { SYSTEM_ACTOR } from '#core/decisionEvent.ts'
import { resolveTriage, type DecisionTriage } from '#core/triage.ts'
import {
  appendDecisionEvent,
  readEventMarks,
  type EventMarks,
} from '#server/db/decisionEventRepository.ts'
import { listDecisions } from '#server/db/decisionRepository.ts'
import { listFindingSummaries } from '#server/db/findingRepository.ts'
import { recordMissingBaselines } from '#server/db/recordMissingBaselines.ts'

/**
 * Latches a re-open the current data shows: stores reopened_at and the trigger, so the decision
 * stays re-opened when the finding falls back, until a user re-confirms it. Writes the reopened
 * event unless the history already ends with one.
 * @param {DatabaseSync} db - Open database
 * @param {DecisionTriage} entry - Evaluated decision
 * @param {EventMarks | undefined} marks - History marks of the decision
 * @param {string} at - Sync time
 * @returns {number} - Events written
 */
const latchReopen = (
  db: DatabaseSync,
  { decision, liveTrigger }: DecisionTriage,
  marks: EventMarks | undefined,
  at: string,
): number => {
  if (decision.reopenedAt !== null || liveTrigger === null) {
    return 0
  }

  db.prepare('UPDATE decisions SET reopened_at = ?, reopen_trigger = ? WHERE id = ?').run(
    at,
    JSON.stringify(liveTrigger),
    decision.id,
  )

  if (marks?.latestType === 'reopened') {
    return 0
  }

  appendDecisionEvent(db, {
    decisionId: decision.id,
    type: 'reopened',
    actor: SYSTEM_ACTOR,
    at,
    payload: { ...liveTrigger },
  })
  return 1
}

/**
 * Writes the expired event of an expired decision once per expiry: unless an expired event
 * follows the latest created or updated event.
 * @param {DatabaseSync} db - Open database
 * @param {DecisionTriage} entry - Evaluated decision
 * @param {EventMarks | undefined} marks - History marks of the decision
 * @param {string} at - Sync time
 * @returns {number} - Events written
 */
const recordExpiry = (
  db: DatabaseSync,
  { decision, effective }: DecisionTriage,
  marks: EventMarks | undefined,
  at: string,
): number => {
  if (effective.state !== 'expired') {
    return 0
  }

  if (marks && marks.lastExpiredId !== null && marks.lastExpiredId > marks.lastChangeId) {
    return 0
  }

  appendDecisionEvent(db, {
    decisionId: decision.id,
    type: 'expired',
    actor: SYSTEM_ACTOR,
    at,
    payload: { expiresAt: effective.expiresAt },
  })
  return 1
}

/**
 * Records what a sync changes about the non-revoked decisions: baselines for governed images
 * seen for the first time, latched re-opens with their reopened event, and one expired event
 * per expiry. Every transition is written exactly once, repeated syncs add nothing.
 * @param {DatabaseSync} db - Open database, inside the sync transaction
 * @param {Date} now - Sync time
 * @returns {number} - Events written
 */
export const recordDecisionTransitions = (db: DatabaseSync, now: Date): number => {
  const at = now.toISOString()
  const findings = listFindingSummaries(db)
  /**
   * Lists the decisions that can still transition.
   * @returns {Decision[]} - Non-revoked decisions
   */
  const current = (): Decision[] =>
    listDecisions(db).filter((decision) => decision.revokedAt === null)
  let decisions = current()

  if (decisions.length === 0) {
    return 0
  }

  if (recordMissingBaselines(db, resolveTriage(findings, decisions, now), at) > 0) {
    decisions = current()
  }

  const marks = readEventMarks(db)
  let written = 0

  for (const entry of resolveTriage(findings, decisions, now).byDecision.values()) {
    const decisionMarks = marks.get(entry.decision.id)

    written += latchReopen(db, entry, decisionMarks, at)
    written += recordExpiry(db, entry, decisionMarks, at)
  }

  return written
}
