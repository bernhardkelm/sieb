import type { WorkerClaim, WorkerResult } from '#core/check.ts'
import type { WorkerApi } from '#checker/api/workerApi.ts'
import { withPulledImage } from '#checker/check/pulledNote.ts'
import { startHeartbeat } from '#checker/check/heartbeat.ts'
import { sendResult } from '#checker/check/sendResult.ts'
import { wipeCheckDir } from '#checker/check/wipe.ts'
import type { CheckerConfig } from '#checker/checkerConfig.ts'
import { runClaude } from '#checker/claude/runClaude.ts'
import { CANCELLED_REASON, failureReason } from '#checker/failureReason.ts'
import type { ProcessRunner } from '#checker/process/processRunner.ts'
import { checkLayout } from '#checker/workspace/checkLayout.ts'
import { createCheckDirs, prepareWorkspace } from '#checker/workspace/prepareWorkspace.ts'
import { resolveImage, type PulledImage } from '#checker/workspace/resolveImage.ts'

/** What running a check needs */
export interface CheckDeps {
  api: WorkerApi
  runner: ProcessRunner
  config: CheckerConfig
  now: () => number // monotonic milliseconds, wall-clock steps must not change durations
  stopSignal: AbortSignal // fires on SIGTERM and SIGINT
  log: (line: string) => void
  heartbeatIntervalMs?: number
  resultRetryMs?: number
}

/**
 * Runs one claimed check: resolves the image digest, prepares the workspace, runs Claude,
 * reports the result and then always wipes the check directory, so a slow wipe on shutdown
 * cannot lose the result. A 409 or 404 heartbeat answer or a worker stop kills the running
 * process group and ends the check as failed.
 * @param {WorkerClaim} claim - Claimed check
 * @param {CheckDeps} deps - API, process runner, config, monotonic clock, stop signal and log
 * @returns {Promise<WorkerResult>} - The result sent to sieb
 */
export const runCheck = async (claim: WorkerClaim, deps: CheckDeps): Promise<WorkerResult> => {
  const started = deps.now()
  const deadline = started + claim.timeoutSeconds * 1000
  const cancel = new AbortController()
  const signal = AbortSignal.any([cancel.signal, deps.stopSignal])
  const layout = checkLayout(deps.config.workdir, claim.checkId)

  /**
   * Returns the time left until the check deadline.
   * @returns {number} - Milliseconds, negative once it passed
   */
  const remainingMs = (): number => deadline - deps.now()
  const context = { runner: deps.runner, config: deps.config, signal, log: deps.log, remainingMs }
  const heartbeat = startHeartbeat({
    api: deps.api,
    checkId: claim.checkId,
    phase: 'preparing',
    onAbort: () => cancel.abort(CANCELLED_REASON),
    log: deps.log,
    intervalMs: deps.heartbeatIntervalMs,
  })
  let image: PulledImage | null = null
  let parts: Omit<WorkerResult, 'durationMs'>

  try {
    await createCheckDirs(layout)
    image = await resolveImage(claim, layout, context)
    await prepareWorkspace(claim, image, layout, context)
    heartbeat.setPhase('investigating')
    parts = await runClaude(claim, image, layout, { ...context, timeoutMs: remainingMs() })
  } catch (error) {
    parts = { status: 'failed', error: failureReason(error, signal), usage: null, reply: null }
  }

  heartbeat.setPhase('reporting')

  const result: WorkerResult = {
    ...(image === null ? parts : withPulledImage(parts, image)),
    durationMs: Math.max(0, Math.round(deps.now() - started)),
  }

  try {
    await sendResult(deps, claim.checkId, result)
  } finally {
    heartbeat.stop()
    await wipeCheckDir(layout.root, deps.log)
  }

  return result
}
