import type { DatabaseSync } from 'node:sqlite'

import type {
  Decision,
  DecisionJustification,
  DecisionScope,
  DecisionStatus,
} from '#core/decision.ts'
import type { DecisionBaseline, ReopenTrigger } from '#core/reopenTrigger.ts'
import type { Severity } from '#core/severity.ts'
import { listBaselines } from '#server/db/decisionBaselineRepository.ts'

export interface DecisionRow {
  id: number
  vuln_id: string
  scope: string
  image_ref: string | null
  status: string
  justification: string | null
  reason: string
  expires_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  revoked_at: string | null
  revoked_by: string | null
  severity_at_decision: string
  kev_at_decision: number
  reopened_at: string | null
  reopen_trigger: string | null
  upstream_pending: number
  waiting_for: string | null
}

/**
 * Maps a decisions row to the domain type, the CHECK constraints guarantee the literal types.
 * @param {DecisionRow} row - Row
 * @param {DecisionBaseline[]} baselines - Baselines of the decision
 * @returns {Decision} - Decision
 */
const toDecision = (row: DecisionRow, baselines: DecisionBaseline[]): Decision => ({
  id: row.id,
  vulnId: row.vuln_id,
  scope: row.scope as DecisionScope,
  imageRef: row.image_ref,
  status: row.status as DecisionStatus,
  justification: row.justification as DecisionJustification | null,
  reason: row.reason,
  expiresAt: row.expires_at,
  upstreamPending: row.upstream_pending === 1,
  waitingFor: row.waiting_for,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  revokedAt: row.revoked_at,
  revokedBy: row.revoked_by,
  severityAtDecision: row.severity_at_decision as Severity,
  kevAtDecision: row.kev_at_decision === 1,
  reopenedAt: row.reopened_at,
  reopenTrigger:
    row.reopen_trigger === null ? null : (JSON.parse(row.reopen_trigger) as ReopenTrigger),
  baselines,
})

/**
 * Maps decision rows with the baselines of all decisions.
 * @param {DatabaseSync} db - Open database
 * @param {DecisionRow[]} rows - Rows
 * @returns {Decision[]} - Decisions in row order
 */
const withBaselines = (db: DatabaseSync, rows: DecisionRow[]): Decision[] => {
  const baselines = rows.length > 0 ? listBaselines(db) : new Map<number, DecisionBaseline[]>()

  return rows.map((row) => toDecision(row, baselines.get(row.id) ?? []))
}

/**
 * Lists all decisions, revoked ones included.
 * @param {DatabaseSync} db - Open database
 * @returns {Decision[]} - Decisions, newest first
 */
export const listDecisions = (db: DatabaseSync): Decision[] =>
  withBaselines(
    db,
    db.prepare('SELECT * FROM decisions ORDER BY id DESC').all() as unknown as DecisionRow[],
  )

/**
 * Lists the decisions of one vulnerability, revoked ones included.
 * @param {DatabaseSync} db - Open database
 * @param {string} vulnId - Vulnerability id
 * @returns {Decision[]} - Decisions, newest first
 */
export const listDecisionsByVuln = (db: DatabaseSync, vulnId: string): Decision[] =>
  withBaselines(
    db,
    db
      .prepare('SELECT * FROM decisions WHERE vuln_id = ? ORDER BY id DESC')
      .all(vulnId) as unknown as DecisionRow[],
  )

/**
 * Reads one decision.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Decision id
 * @returns {Decision | null} - Decision, null when unknown
 */
export const getDecision = (db: DatabaseSync, id: number): Decision | null => {
  const row = db.prepare('SELECT * FROM decisions WHERE id = ?').get(id) as DecisionRow | undefined

  return row ? toDecision(row, listBaselines(db, id).get(id) ?? []) : null
}

/**
 * Finds the non-revoked decision for a vuln_id, scope and image_ref, at most one exists.
 * @param {DatabaseSync} db - Open database
 * @param {string} vulnId - Vulnerability id
 * @param {DecisionScope} scope - Scope
 * @param {string | null} imageRef - Image for scope image, null for scope all
 * @returns {Decision | null} - Current decision, null when none
 */
export const findCurrentDecision = (
  db: DatabaseSync,
  vulnId: string,
  scope: DecisionScope,
  imageRef: string | null,
): Decision | null => {
  const row = db
    .prepare(
      `SELECT * FROM decisions WHERE vuln_id = ? AND scope = ? AND ifnull(image_ref, '') = ?
       AND revoked_at IS NULL`,
    )
    .get(vulnId, scope, imageRef ?? '') as DecisionRow | undefined

  return row ? toDecision(row, listBaselines(db, row.id).get(row.id) ?? []) : null
}
