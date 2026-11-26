import type { DatabaseSync } from 'node:sqlite'

import type { DecisionEvent, DecisionEventType } from '#core/decisionEvent.ts'

interface DecisionEventRow {
  id: number
  decision_id: number
  type: string
  actor: string
  at: string
  payload: string
}

/**
 * Maps a decision_events row to the domain type.
 * @param {DecisionEventRow} row - Row
 * @returns {DecisionEvent} - Event
 */
const toEvent = (row: DecisionEventRow): DecisionEvent => ({
  id: row.id,
  decisionId: row.decision_id,
  type: row.type as DecisionEventType,
  actor: row.actor,
  at: row.at,
  payload: JSON.parse(row.payload) as Record<string, unknown>,
})

/**
 * Appends a history entry to a decision.
 * @param {DatabaseSync} db - Open database
 * @param {Omit<DecisionEvent, 'id'>} event - Event without id
 * @returns {void}
 */
export const appendDecisionEvent = (db: DatabaseSync, event: Omit<DecisionEvent, 'id'>): void => {
  db.prepare(
    'INSERT INTO decision_events (decision_id, type, actor, at, payload) VALUES (?, ?, ?, ?, ?)',
  ).run(event.decisionId, event.type, event.actor, event.at, JSON.stringify(event.payload))
}

/**
 * Lists the history of several decisions.
 * @param {DatabaseSync} db - Open database
 * @param {readonly number[]} decisionIds - Decision ids
 * @returns {DecisionEvent[]} - Events, oldest first
 */
export const listDecisionEvents = (
  db: DatabaseSync,
  decisionIds: readonly number[],
): DecisionEvent[] => {
  if (decisionIds.length === 0) {
    return []
  }

  const rows = db
    .prepare(
      'SELECT * FROM decision_events WHERE decision_id IN (SELECT value FROM json_each(?)) ORDER BY id',
    )
    .all(JSON.stringify(decisionIds)) as unknown as DecisionEventRow[]

  return rows.map(toEvent)
}

/** Positions in the history of a decision that tell whether a transition was recorded */
export interface EventMarks {
  latestType: DecisionEventType
  lastChangeId: number // latest created or updated event
  lastExpiredId: number | null
}

/**
 * Reads the event marks of every decision with history.
 * @param {DatabaseSync} db - Open database
 * @returns {Map<number, EventMarks>} - Marks per decision id
 */
export const readEventMarks = (db: DatabaseSync): Map<number, EventMarks> => {
  const rows = db
    .prepare(
      `SELECT decision_id,
         (SELECT type FROM decision_events latest WHERE latest.decision_id = e.decision_id
          ORDER BY id DESC LIMIT 1) AS latest_type,
         ifnull(MAX(CASE WHEN type IN ('created', 'updated') THEN id END), 0) AS last_change_id,
         MAX(CASE WHEN type = 'expired' THEN id END) AS last_expired_id
       FROM decision_events e GROUP BY decision_id`,
    )
    .all() as unknown as {
    decision_id: number
    latest_type: string
    last_change_id: number
    last_expired_id: number | null
  }[]

  return new Map(
    rows.map((row) => [
      row.decision_id,
      {
        latestType: row.latest_type as DecisionEventType,
        lastChangeId: row.last_change_id,
        lastExpiredId: row.last_expired_id,
      },
    ]),
  )
}
