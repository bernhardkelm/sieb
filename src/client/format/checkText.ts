import type { CheckPhase, CheckView } from '#core/check.ts'

export const CHECK_PHASE_LABELS: Record<CheckPhase, string> = {
  preparing: 'preparing',
  investigating: 'investigating',
  reporting: 'reporting',
}

export const NO_FAILURE_REASON = 'The worker gave no reason.'

/**
 * Formats a duration compactly: seconds below a minute, minutes and seconds below an hour.
 * @param {number} ms - Duration in ms, negative values count as zero
 * @returns {string} - Text such as "42s", "3m 07s" or "1h 02m"
 */
export const formatElapsed = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / 1000))

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) {
    return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`
  }

  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

/**
 * Returns how long a running check has run so far.
 * @param {CheckView} check - Check, startedAt null counts as just started
 * @param {Date} now - Current time
 * @returns {string} - Elapsed time text
 */
export const elapsedText = (check: CheckView, now: Date): string =>
  formatElapsed(check.startedAt === null ? 0 : now.getTime() - Date.parse(check.startedAt))

/**
 * Returns the text of the status chip of a check.
 * @param {CheckView} check - Check
 * @param {Date} now - Current time, for the elapsed time of a running check
 * @returns {string} - Text such as "Queued · #2" or "Checking · investigating · 1m 05s"
 */
export const checkChipLabel = (check: CheckView, now: Date): string => {
  switch (check.state) {
    case 'queued':
      return check.position === null ? 'Queued' : `Queued · #${check.position}`
    case 'running':
      return `Checking · ${CHECK_PHASE_LABELS[check.phase ?? 'preparing']} · ${elapsedText(check, now)}`
    case 'failed':
      return 'Check failed'
    case 'cancelled':
      return 'Check cancelled'
    case 'done':
      return check.proposalId === null
        ? 'Checked, no proposal'
        : `Checked · proposal #${check.proposalId}`
  }
}

/**
 * Returns the tooltip of the status chip of a check.
 * @param {CheckView} check - Check
 * @returns {string} - Explanation, the reason of a failed check
 */
export const checkChipHint = (check: CheckView): string => {
  switch (check.state) {
    case 'queued':
      return `Auto-check queued by ${check.requestedBy}, waits for the worker`
    case 'running':
      return `Claude investigates this finding, requested by ${check.requestedBy}`
    case 'failed':
      return `Check failed: ${check.error ?? NO_FAILURE_REASON}`
    case 'cancelled':
      return 'The check was cancelled before it finished'
    case 'done':
      return check.proposalId === null
        ? 'Claude finished without filing a proposal, the Checks page shows its reply'
        : 'Claude filed a proposal, open it to review'
  }
}
