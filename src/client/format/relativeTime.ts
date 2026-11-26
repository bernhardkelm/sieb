const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const MONTH_MS = 30 * DAY_MS
const YEAR_MS = 365 * DAY_MS

const UNITS: [limit: number, size: number, suffix: string][] = [
  [HOUR_MS, MINUTE_MS, 'm'],
  [DAY_MS, HOUR_MS, 'h'],
  [MONTH_MS, DAY_MS, 'd'],
  [YEAR_MS, MONTH_MS, 'mo'],
  [Number.POSITIVE_INFINITY, YEAR_MS, 'y'],
]

/**
 * Formats the distance between a timestamp and now compactly, such as "5m ago" or "in 3d".
 * @param {string} iso - ISO timestamp
 * @param {Date} now - Current time
 * @returns {string} - Relative time, "just now" below one minute
 */
export const formatRelative = (iso: string, now: Date): string => {
  const delta = Date.parse(iso) - now.getTime()
  const distance = Math.abs(delta)

  if (distance < MINUTE_MS) {
    return 'just now'
  }

  const [, size, suffix] = UNITS.find(([limit]) => distance < limit) ?? UNITS[UNITS.length - 1]!
  const amount = `${Math.floor(distance / size)}${suffix}`

  return delta < 0 ? `${amount} ago` : `in ${amount}`
}

/**
 * Formats a timestamp as local date and time.
 * @param {string} iso - ISO timestamp
 * @returns {string} - Date and time in the locale of the browser
 */
export const formatAbsolute = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/**
 * Formats a timestamp as local date without time.
 * @param {string} iso - ISO timestamp
 * @returns {string} - Date in the locale of the browser
 */
export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })

/**
 * Formats a calendar day without shifting it into the local time zone.
 * @param {string} day - Date as YYYY-MM-DD
 * @returns {string} - Date in the locale of the browser
 */
export const formatDay = (day: string): string =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  })
