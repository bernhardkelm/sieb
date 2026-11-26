import type { DecisionStatus } from '#core/decision.ts'

export const ACCEPTED_EXPIRY_DAYS = 90

export const MAX_EXPIRY_DAYS = 3 * 366

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Returns the default expiry of a new decision: accepted risks expire after 90 days, other
 * statuses never expire by default.
 * @param {DecisionStatus} status - Decision status
 * @param {Date} now - Current time
 * @returns {string | null} - ISO timestamp in UTC, null for no expiry
 */
export const defaultExpiresAt = (status: DecisionStatus, now: Date): string | null =>
  status === 'accepted'
    ? new Date(now.getTime() + ACCEPTED_EXPIRY_DAYS * DAY_MS).toISOString()
    : null

/**
 * Returns whether an expiry lies at or before a point in time.
 * @param {string | null} expiresAt - ISO timestamp or null for no expiry
 * @param {Date} now - Current time
 * @returns {boolean} - True when expired
 */
export const isExpired = (expiresAt: string | null, now: Date): boolean =>
  expiresAt !== null && Date.parse(expiresAt) <= now.getTime()
