import type { Decision, DecisionScope, DecisionStatus } from '#core/decision.ts'
import { defaultExpiresAt } from '#core/decisionExpiry.ts'

/** Longest reason or comment the server accepts */
export const TEXT_MAX_LENGTH = 2000

/** What the decision form submits, expiresAt null for no expiry */
export interface DecisionFormValue {
  status: DecisionStatus
  reason: string
  scope: DecisionScope
  expiresAt: string | null
  expiryTouched: boolean // the user changed the date or the never toggle
  reconfirm: boolean // re-arms a re-opened decision, only offered when editing one
}

/** Starting values of the form, absent fields take the defaults */
export type DecisionFormInitial = Partial<
  Omit<DecisionFormValue, 'expiresAt' | 'expiryTouched' | 'reconfirm'>
> & {
  expiresAt?: string | null
}

/**
 * Pads a number to two digits.
 * @param {number} value - Number
 * @returns {string} - Padded number
 */
const pad = (value: number): string => String(value).padStart(2, '0')

/**
 * Converts a timestamp to the value of a date input in local time.
 * @param {string} iso - ISO timestamp
 * @returns {string} - Date as YYYY-MM-DD
 */
export const toDateInput = (iso: string): string => {
  const date = new Date(iso)

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Converts the value of a date input to the end of that local day.
 * @param {string} value - Date as YYYY-MM-DD
 * @returns {string | null} - ISO timestamp, null for an empty or unreadable value
 */
export const fromDateInput = (value: string): string | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return null
  }

  const [, year, month, day] = match.map(Number) as [number, number, number, number]

  return new Date(year, month - 1, day, 23, 59, 59).toISOString()
}

/**
 * Returns the expiry date a status suggests, as date input value.
 * @param {DecisionStatus} status - Decision status
 * @param {Date} now - Current time
 * @returns {string | null} - Date as YYYY-MM-DD, null for no expiry
 */
export const defaultExpiryDate = (status: DecisionStatus, now: Date): string | null => {
  const expiresAt = defaultExpiresAt(status, now)

  return expiresAt === null ? null : toDateInput(expiresAt)
}

/**
 * Returns whether an expiry lies in the past.
 * @param {string | null} expiresAt - ISO timestamp, null for no expiry
 * @param {Date} now - Current time
 * @returns {boolean} - True for a past expiry
 */
export const isLapsed = (expiresAt: string | null, now: Date): boolean =>
  expiresAt !== null && Date.parse(expiresAt) <= now.getTime()

/**
 * Returns the form values for editing an existing decision. An expiry in the past is replaced by
 * the default of its status, so saving revives the decision instead of failing.
 * @param {Decision} decision - Decision to edit
 * @param {Date} now - Current time
 * @returns {DecisionFormInitial} - Starting values
 */
export const initialFromDecision = (decision: Decision, now: Date): DecisionFormInitial => ({
  status: decision.status,
  reason: decision.reason,
  scope: decision.scope,
  expiresAt: isLapsed(decision.expiresAt, now)
    ? defaultExpiresAt(decision.status, now)
    : decision.expiresAt,
})
