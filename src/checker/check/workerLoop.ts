import type { WorkerClaim, WorkerResult } from '#core/check.ts'
import { InvalidClaimError } from '#checker/api/parseClaim.ts'
import type { WorkerApi } from '#checker/api/workerApi.ts'
import { errorMessage } from '#checker/safeText.ts'

/** Longest wait between claim attempts after repeated failures */
export const BACKOFF_MAX_MS = 5 * 60_000

/** What the poll loop needs */
export interface LoopDeps {
  api: WorkerApi
  pollMs: number
  stopSignal: AbortSignal
  sleep: (ms: number, signal: AbortSignal) => Promise<void>
  check: (claim: WorkerClaim) => Promise<WorkerResult>
  log: (line: string) => void
}

/**
 * Returns the next backoff delay, doubling from the poll interval up to five minutes.
 * @param {number} current - Current delay, 0 after a success
 * @param {number} pollMs - Poll interval
 * @returns {number} - Next delay in milliseconds
 */
export const nextBackoff = (current: number, pollMs: number): number =>
  Math.min(current > 0 ? current * 2 : pollMs, BACKOFF_MAX_MS)

/**
 * Reports a claim that failed validation as failed, so it does not wait for its timeout.
 * @param {LoopDeps} deps - API and log
 * @param {InvalidClaimError} error - Validation error with the check id
 * @returns {Promise<void>}
 */
const rejectClaim = async (deps: LoopDeps, error: InvalidClaimError): Promise<void> => {
  if (error.checkId === null) {
    return
  }

  const result: WorkerResult = {
    status: 'failed',
    error: error.message,
    durationMs: 0,
    usage: null,
    reply: null,
  }

  await deps.api.result(error.checkId, result).catch(() => undefined)
}

/**
 * Polls sieb for checks and runs them one at a time until the stop signal fires. An empty
 * queue waits one poll interval, a failed claim backs off exponentially.
 * @param {LoopDeps} deps - API, poll interval, stop signal, sleep, check runner and log
 * @returns {Promise<void>} - Resolves once stopped
 */
export const runWorkerLoop = async (deps: LoopDeps): Promise<void> => {
  let backoff = 0

  while (!deps.stopSignal.aborted) {
    let claim: WorkerClaim | null

    try {
      claim = await deps.api.claim()
      backoff = 0
    } catch (error) {
      if (error instanceof InvalidClaimError && error.checkId !== null) {
        deps.log(`[sieb-checker] ${error.message}, check ${error.checkId} failed`)
        await rejectClaim(deps, error)
        continue
      }

      backoff = nextBackoff(backoff, deps.pollMs)
      deps.log(
        `[sieb-checker] claim failed (${errorMessage(error)}), retrying in ${backoff / 1000} s`,
      )
      await deps.sleep(backoff, deps.stopSignal)
      continue
    }

    if (!claim) {
      await deps.sleep(deps.pollMs, deps.stopSignal)
      continue
    }

    deps.log(
      `[sieb-checker] check ${claim.checkId}: ${JSON.stringify(claim.vulnId)} in ${claim.imageRef}`,
    )
    const result = await deps.check(claim)

    deps.log(
      `[sieb-checker] check ${claim.checkId} ${result.status} after ${Math.round(result.durationMs / 1000)} s` +
        (result.error ? `: ${result.error}` : ''),
    )
  }
}
