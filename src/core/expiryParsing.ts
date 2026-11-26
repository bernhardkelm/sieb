// date, optionally followed by a time with a mandatory Z or +hh:mm / -hh:mm offset
const ISO_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2}))?$/

/**
 * Returns whether year, month and day form a real calendar date.
 * @param {number} year - Year
 * @param {number} month - Month, 1 to 12
 * @param {number} day - Day of the month
 * @returns {boolean} - False for dates like 2026-02-30 that Date.parse rolls over
 */
const isCalendarDate = (year: number, month: number, day: number): boolean => {
  const date = new Date(Date.UTC(year, month - 1, day))

  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/**
 * Parses an expiry timestamp. Accepts ISO 8601 date-times with Z or an explicit offset, and
 * date-only values (YYYY-MM-DD) as the end of that day in UTC. Rejects date-times without an
 * offset, whose meaning depends on the server time zone.
 * @param {string} value - Raw value
 * @returns {number | null} - Epoch milliseconds, null when malformed
 */
export const parseExpiry = (value: string): number | null => {
  const match = ISO_PATTERN.exec(value)

  if (!match) {
    return null
  }

  const [year, month, day] = match.slice(1, 4).map(Number) as [number, number, number]

  if (!isCalendarDate(year, month, day)) {
    return null
  }

  const time =
    value.length === 10 ? Date.UTC(year, month - 1, day, 23, 59, 59, 999) : Date.parse(value)

  return Number.isNaN(time) ? null : time
}
