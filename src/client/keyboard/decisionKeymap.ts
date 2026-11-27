import type { DecisionStatus } from '#core/decision.ts'

export type DecisionAction = 'accept' | 'notAffected' | 'fixPlanned'

export interface DecisionKey {
  /** `KeyboardEvent.key` that opens the decision */
  key: string
  /** Triage and hint action id */
  action: DecisionAction
  status: DecisionStatus
  /** Label of the hint and the selection bar button */
  label: string
}

export const DECISION_KEYMAP: readonly DecisionKey[] = [
  { key: 'a', action: 'accept', status: 'accepted', label: 'Accept' },
  { key: 'n', action: 'notAffected', status: 'not_affected', label: 'Not affected' },
  { key: 'f', action: 'fixPlanned', status: 'fix_planned', label: 'Fix planned' },
]

/**
 * Returns the decision status a key opens.
 * @param {string} key - `KeyboardEvent.key`
 * @returns {DecisionStatus | undefined} - Status, undefined for other keys
 */
export const decisionStatusOfKey = (key: string): DecisionStatus | undefined =>
  DECISION_KEYMAP.find((candidate) => candidate.key === key)?.status

/**
 * Returns the decision status of a triage or hint action.
 * @param {string} action - Action id
 * @returns {DecisionStatus | undefined} - Status, undefined for actions that decide nothing
 */
export const decisionStatusOfAction = (action: string): DecisionStatus | undefined =>
  DECISION_KEYMAP.find((candidate) => candidate.action === action)?.status
