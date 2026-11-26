import type { DatabaseSync } from 'node:sqlite'

import type { DecisionBaseline } from '#core/reopenTrigger.ts'
import type { Severity } from '#core/severity.ts'

interface BaselineRow {
  decision_id: number
  image_ref: string
  severity: string
  kev: number
  recorded_at: string
}

/**
 * Maps a decision_baselines row to the domain type, the CHECK constraints guarantee the literal.
 * @param {BaselineRow} row - Row
 * @returns {DecisionBaseline} - Baseline
 */
const toBaseline = (row: BaselineRow): DecisionBaseline => ({
  imageRef: row.image_ref,
  severity: row.severity as Severity,
  kev: row.kev === 1,
  recordedAt: row.recorded_at,
})

/**
 * Reads the baselines of one decision or of all decisions.
 * @param {DatabaseSync} db - Open database
 * @param {number | null} decisionId - One decision, null for all
 * @returns {Map<number, DecisionBaseline[]>} - Baselines per decision id, sorted by image_ref
 */
export const listBaselines = (
  db: DatabaseSync,
  decisionId: number | null = null,
): Map<number, DecisionBaseline[]> => {
  const rows = (decisionId === null
    ? db.prepare('SELECT * FROM decision_baselines ORDER BY decision_id, image_ref').all()
    : db
        .prepare('SELECT * FROM decision_baselines WHERE decision_id = ? ORDER BY image_ref')
        .all(decisionId)) as unknown as BaselineRow[]
  const byDecision = new Map<number, DecisionBaseline[]>()

  for (const row of rows) {
    byDecision.set(row.decision_id, [...(byDecision.get(row.decision_id) ?? []), toBaseline(row)])
  }

  return byDecision
}

/**
 * Replaces every baseline of a decision.
 * @param {DatabaseSync} db - Open database
 * @param {number} decisionId - Decision id
 * @param {readonly DecisionBaseline[]} baselines - New baselines
 * @returns {void}
 */
export const replaceBaselines = (
  db: DatabaseSync,
  decisionId: number,
  baselines: readonly DecisionBaseline[],
): void => {
  db.prepare('DELETE FROM decision_baselines WHERE decision_id = ?').run(decisionId)
  addBaselines(db, decisionId, baselines)
}

/**
 * Adds baselines for images a decision has none for yet, existing ones stay untouched.
 * @param {DatabaseSync} db - Open database
 * @param {number} decisionId - Decision id
 * @param {readonly DecisionBaseline[]} baselines - Baselines to add
 * @returns {number} - Baselines added
 */
export const addBaselines = (
  db: DatabaseSync,
  decisionId: number,
  baselines: readonly DecisionBaseline[],
): number => {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO decision_baselines (decision_id, image_ref, severity, kev, recorded_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
  let added = 0

  for (const baseline of baselines) {
    added += Number(
      insert.run(
        decisionId,
        baseline.imageRef,
        baseline.severity,
        baseline.kev ? 1 : 0,
        baseline.recordedAt,
      ).changes,
    )
  }

  return added
}
