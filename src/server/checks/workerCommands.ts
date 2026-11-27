import type { CheckPhase, WorkerClaim, WorkerResult } from '#core/check.ts'
import { buildCheckPrompt } from '#core/checkPrompt.ts'
import { checkedImagesOf } from '#core/checkPull.ts'
import type { CheckContext } from '#server/checks/checkContext.ts'
import { claimLogLine, endLogLine, endLogLines } from '#server/checks/checkLogLines.ts'
import { expireAndLog } from '#server/checks/readChecks.ts'
import { getCheck, touchRunningCheck } from '#server/db/checkRepository.ts'
import { claimCheck } from '#server/db/claimCheck.ts'
import { endCheck } from '#server/db/endCheck.ts'
import { listInstances } from '#server/db/instanceRepository.ts'
import { triageWorkflow } from '#server/mcp/triagePromptText.ts'
import { tokenLogLine } from '#server/tokenLogLine.ts'

export type WorkerUpdate = 'ok' | 'not_found' | 'not_running'

/**
 * Starts the next queued check for the worker after failing timed out ones. The prompt carries the
 * full triage workflow, a headless run cannot load the triage_finding prompt. The answer is the
 * only place the token secret appears.
 * @param {CheckContext} context - Check context
 * @returns {WorkerClaim | null} - Assignment, null while a check runs or the queue is empty
 */
export const claimForWorker = (context: CheckContext): WorkerClaim | null => {
  expireAndLog(context)

  const { claimed, skipped } = claimCheck(
    context.db,
    {
      publicRegistries: context.publicRegistries,
      timeoutSeconds: context.timeoutSeconds,
      credentialVault: context.privateVault,
    },
    context.clock(),
  )

  for (const check of skipped) {
    context.log(endLogLine(check, 'not startable'))
  }

  if (claimed === null) {
    return null
  }

  const { check, finding, instances, pull, token, secret } = claimed

  context.log(tokenLogLine('created', token))
  context.log(claimLogLine(check, token))

  return {
    checkId: check.id,
    findingId: finding.id,
    vulnId: finding.vulnId,
    imageRef: pull.imageRef,
    imageDigest: pull.imageDigest,
    images: pull.images,
    prompt: `${buildCheckPrompt({ finding: { ...finding, packages: [] }, instances }, pull)}\n\n${triageWorkflow(true)}`,
    mcpUrl: context.mcpUrl,
    token: secret,
    timeoutSeconds: context.timeoutSeconds,
    maxTurns: context.maxTurns,
  }
}

/**
 * Records a heartbeat after failing timed out checks, so a heartbeat of a timed out check is
 * refused like one of a cancelled check.
 * @param {CheckContext} context - Check context
 * @param {number} id - Check id
 * @param {CheckPhase} phase - Phase the worker is in
 * @returns {WorkerUpdate} - ok, not_found for an unknown check, not_running once it ended
 */
export const recordHeartbeat = (
  context: CheckContext,
  id: number,
  phase: CheckPhase,
): WorkerUpdate => {
  expireAndLog(context)

  if (touchRunningCheck(context.db, id, phase, context.clock())) {
    return 'ok'
  }

  return getCheck(context.db, id) === null ? 'not_found' : 'not_running'
}

/**
 * Ends a running check with the worker's result, links the proposal its token filed and
 * deletes the token. The exported digests are stored with the tags the finding's instances
 * name for them, and the repository the worker checked out with them.
 * @param {CheckContext} context - Check context
 * @param {number} id - Check id
 * @param {WorkerResult} result - Validated result
 * @returns {WorkerUpdate} - ok, not_found for an unknown check, not_running once it ended
 */
export const recordResult = (
  context: CheckContext,
  id: number,
  result: WorkerResult,
): WorkerUpdate => {
  expireAndLog(context)

  const check = getCheck(context.db, id)

  if (check === null) {
    return 'not_found'
  }

  const digests = result.pulledDigests ?? (result.pulledDigest ? [result.pulledDigest] : [])
  const ended =
    check.state === 'running'
      ? endCheck(
          context.db,
          check,
          {
            state: result.status,
            error: result.error,
            durationMs: result.durationMs,
            usage: result.usage,
            reply: result.reply,
            pulledDigest: result.pulledDigest ?? null,
            pulledImages: checkedImagesOf(digests, listInstances(context.db, check.findingId)),
            source: result.source ?? null,
          },
          context.clock(),
        )
      : null

  if (ended === null) {
    return 'not_running'
  }

  for (const line of endLogLines(ended, 'result')) {
    context.log(line)
  }

  return 'ok'
}
