import type { DatabaseSync } from 'node:sqlite'

import type { Decision } from '#core/decision.ts'
import { getDecision } from '#server/db/decisionRepository.ts'

export type DecisionCommandError = 'not_found' | 'revoked' | 'conflict' | 'unknown_finding'

export type DecisionCommandResult =
  | { ok: true; decision: Decision }
  | { ok: false; error: DecisionCommandError; decisionId?: number }

/**
 * Reads a decision that must exist after a write.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Decision id
 * @returns {Decision} - Decision
 * @throws {Error} - When the row is missing
 */
export const mustGetDecision = (db: DatabaseSync, id: number): Decision => {
  const decision = getDecision(db, id)

  if (!decision) {
    throw new Error(`decision ${id} vanished`)
  }

  return decision
}
