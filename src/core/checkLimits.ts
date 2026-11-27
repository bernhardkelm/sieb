/** Findings one POST /api/checks may queue */
export const MAX_CHECK_FINDINGS = 100

/** Queued and running checks at once, guards against accidental floods, not a daily limit */
export const MAX_OPEN_CHECKS = 500

/** Finished and cancelled checks GET /api/checks lists */
export const MAX_RECENT_CHECKS = 50

/** Windows of the usage summary GET /api/checks answers, in days */
export const CHECK_USAGE_WINDOW_DAYS = { last7Days: 7, last30Days: 30 } as const

/** Longest error text of a check, in code points like textLength */
export const MAX_CHECK_ERROR_LENGTH = 500

/** Longest reply of a check, in code points like textLength */
export const MAX_CHECK_REPLY_LENGTH = 4000

export const DEFAULT_CHECK_TIMEOUT_SECONDS = 1200
export const MIN_CHECK_TIMEOUT_SECONDS = 1
export const MAX_CHECK_TIMEOUT_SECONDS = 4 * 60 * 60

export const DEFAULT_CHECK_MAX_TURNS = 60
export const MIN_CHECK_MAX_TURNS = 1
export const MAX_CHECK_MAX_TURNS = 500

/** How often the worker sends a heartbeat during a check */
export const HEARTBEAT_INTERVAL_MS = 30 * 1000

/** A running check without a heartbeat for this long has lost its worker */
export const HEARTBEAT_STALE_MS = 4 * HEARTBEAT_INTERVAL_MS

/** Slack past the configured timeout before sieb fails a running check itself */
export const TIMEOUT_MARGIN_MS = 60 * 1000

/** A worker counts as online while its last request is at most this old, three heartbeats */
export const WORKER_ONLINE_MS = 3 * HEARTBEAT_INTERVAL_MS

/** Longest idle poll interval of the worker, well inside WORKER_ONLINE_MS */
export const MAX_WORKER_POLL_SECONDS = 60

/** Lifetime of the check token beyond the configured timeout */
export const CHECK_TOKEN_GRACE_MS = 10 * 60 * 1000

/**
 * Returns the name of the personal token a check runs with.
 * @param {number} checkId - Check id
 * @returns {string} - Token name such as "Auto-check #12"
 */
export const checkTokenName = (checkId: number): string => `Auto-check #${checkId}`

/**
 * Returns the expiry of the token minted when a check starts.
 * @param {Date} startedAt - Claim time
 * @param {number} timeoutSeconds - Configured check timeout
 * @returns {Date} - Timeout plus CHECK_TOKEN_GRACE_MS after the start
 */
export const checkTokenExpiry = (startedAt: Date, timeoutSeconds: number): Date =>
  new Date(startedAt.getTime() + timeoutSeconds * 1000 + CHECK_TOKEN_GRACE_MS)

/**
 * Returns why a running check has timed out, if it has: no heartbeat for HEARTBEAT_STALE_MS, or
 * running longer than the timeout plus TIMEOUT_MARGIN_MS.
 * @param {{ startedAt: string; heartbeatAt: string }} check - Start and last heartbeat of a running check
 * @param {Date} now - Current time
 * @param {number} timeoutSeconds - Configured check timeout
 * @returns {string | null} - Error text for humans, null while the check may keep running
 */
export const checkTimeoutError = (
  check: { startedAt: string; heartbeatAt: string },
  now: Date,
  timeoutSeconds: number,
): string | null => {
  const at = now.getTime()

  if (at - Date.parse(check.startedAt) > timeoutSeconds * 1000 + TIMEOUT_MARGIN_MS) {
    return `Timed out: the check ran longer than ${timeoutSeconds} seconds.`
  }

  if (at - Date.parse(check.heartbeatAt) > HEARTBEAT_STALE_MS) {
    return `Timed out: the worker sent no heartbeat for ${HEARTBEAT_STALE_MS / 1000} seconds.`
  }

  return null
}

/**
 * Cuts a text to a number of code points, the unit SQLite length() counts, so a cut text passes
 * the length checks of the checks table.
 * @param {string} text - Text
 * @param {number} max - Longest result
 * @returns {string} - Text of at most max characters
 */
export const capText = (text: string, max: number): string => {
  const chars = Array.from(text)

  return chars.length <= max ? text : chars.slice(0, max).join('')
}

/**
 * Counts the code points of a text, the unit SQLite length() and capText count.
 * @param {string} text - Text
 * @returns {number} - Code points
 */
export const textLength = (text: string): number => Array.from(text).length
