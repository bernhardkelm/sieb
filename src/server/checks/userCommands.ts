import type { CheckCreateResponse } from '#core/check.ts'
import type { CheckContext } from '#server/checks/checkContext.ts'
import { endLogLines } from '#server/checks/checkLogLines.ts'
import { expireAndLog } from '#server/checks/readChecks.ts'
import { getCheck, listOpenChecks } from '#server/db/checkRepository.ts'
import { toCheckView } from '#server/db/checkRows.ts'
import { CANCELLED, endCheck } from '#server/db/endCheck.ts'
import { queueChecks } from '#server/db/queueChecks.ts'
import { logSafe } from '#server/logSafe.ts'

export type CancelResult = 'cancelled' | 'not_found' | 'finished'

/**
 * Queues checks of a user's findings and answers them with their queue positions.
 * @param {CheckContext} context - Check context
 * @param {string} actor - Requesting user
 * @param {readonly number[]} findingIds - Distinct finding ids
 * @returns {CheckCreateResponse} - Queued checks and skipped findings
 */
export const queueForUser = (
  context: CheckContext,
  actor: string,
  findingIds: readonly number[],
): CheckCreateResponse => {
  const { queued, skipped } = queueChecks(
    context.db,
    { findingIds, requestedBy: actor, publicRegistries: context.publicRegistries },
    context.clock(),
  )
  const positions = new Map(
    listOpenChecks(context.db)
      .filter((check) => check.state === 'queued')
      .map((check, index) => [check.id, index + 1]),
  )

  if (queued.length > 0) {
    context.log(
      `[sieb] ${logSafe(actor)} queued check(s) ${queued.map((check) => check.id).join(', ')}`,
    )
  }

  return {
    queued: queued.map((check) => toCheckView(check, positions.get(check.id) ?? null)),
    skipped,
  }
}

/**
 * Cancels a queued or running check. A running check's token is deleted at once, so the worker
 * can file nothing more, and its next heartbeat is refused.
 * @param {CheckContext} context - Check context
 * @param {string} actor - Cancelling user
 * @param {number} id - Check id
 * @returns {CancelResult} - cancelled, not_found for an unknown check, finished once it ended
 */
export const cancelForUser = (context: CheckContext, actor: string, id: number): CancelResult => {
  expireAndLog(context)

  const check = getCheck(context.db, id)

  if (check === null) {
    return 'not_found'
  }

  const ended = endCheck(context.db, check, CANCELLED, context.clock())

  if (ended === null) {
    return 'finished'
  }

  for (const line of endLogLines(ended, `by ${actor}`)) {
    context.log(line)
  }

  return 'cancelled'
}
