import type { ChecksResponse } from '#core/check.ts'
import type { CheckContext } from '#server/checks/checkContext.ts'
import { endLogLines } from '#server/checks/checkLogLines.ts'
import { listOpenChecks, listRecentChecks } from '#server/db/checkRepository.ts'
import { toCheckView } from '#server/db/checkRows.ts'
import { readCheckUsageSummary } from '#server/db/checkUsageSummary.ts'
import { expireChecks } from '#server/db/expireChecks.ts'

/** GET /api/checks while SIEB_CHECKS_ENABLED is off */
export const DISABLED_CHECKS: ChecksResponse = {
  enabled: false,
  workerOnline: false,
  running: null,
  queued: [],
  recent: [],
  usage: null,
}

/**
 * Fails the running checks that timed out and logs each of them.
 * @param {CheckContext} context - Check context
 * @returns {void}
 */
export const expireAndLog = (context: CheckContext): void => {
  for (const ended of expireChecks(context.db, context.timeoutSeconds, context.clock())) {
    for (const line of endLogLines(ended, 'timeout')) {
      context.log(line)
    }
  }
}

/**
 * Reads the check overview after failing timed out checks: the running check, the queue with
 * positions, the newest ended checks and the usage of the last 7 and 30 days.
 * @param {CheckContext} context - Check context
 * @returns {ChecksResponse} - Overview
 */
export const readChecks = (context: CheckContext): ChecksResponse => {
  expireAndLog(context)

  const open = listOpenChecks(context.db)
  const running = open.find((check) => check.state === 'running') ?? null
  const queued = open.filter((check) => check.state === 'queued')

  return {
    enabled: true,
    workerOnline: context.presence.online(context.clock()),
    running: running === null ? null : toCheckView(running),
    queued: queued.map((check, index) => toCheckView(check, index + 1)),
    recent: listRecentChecks(context.db).map((check) => toCheckView(check)),
    usage: readCheckUsageSummary(context.db, context.clock()),
  }
}
