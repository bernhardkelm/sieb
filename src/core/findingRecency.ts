import type { FindingView } from '#core/findingView.ts'
import { DAY_MS } from '#core/timeUnits.ts'

/** Days after the first sighting during which a finding is recent */
export const NEW_WITHIN_DAYS = 7

/**
 * Returns the start of the recent window.
 * @param {Date} now - Current time
 * @returns {string} - ISO timestamp NEW_WITHIN_DAYS days before now
 */
export const newSince = (now: Date): string =>
  new Date(now.getTime() - NEW_WITHIN_DAYS * DAY_MS).toISOString()

/**
 * Returns whether sieb first saw a finding within the recent window, what the "new this week"
 * filter keeps.
 * @param {string} firstSeen - ISO timestamp of the first sighting
 * @param {Date} now - Current time
 * @returns {boolean} - True when first seen within the last NEW_WITHIN_DAYS days
 */
export const isRecentFinding = (firstSeen: string, now: Date): boolean =>
  Date.parse(firstSeen) >= Date.parse(newSince(now))

/**
 * Returns whether a finding is new for the acting user: recent and not seen by that user yet,
 * what the "new" tag and the Triage count show.
 * @param {Pick<FindingView, 'firstSeen' | 'seen'>} finding - Finding with its seen state
 * @param {Date} now - Current time
 * @returns {boolean} - True for a recent finding the user has not seen
 */
export const isUnseenNew = (finding: Pick<FindingView, 'firstSeen' | 'seen'>, now: Date): boolean =>
  finding.seen !== true && isRecentFinding(finding.firstSeen, now)
