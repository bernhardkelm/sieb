import { mkdir } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { setTimeout as sleep } from 'node:timers/promises'

import { errorMessage } from '#core/errorMessage.ts'
import { createWorkerApi } from '#checker/api/workerApi.ts'
import { runCheck } from '#checker/check/runCheck.ts'
import { wipeStaleChecks } from '#checker/check/wipe.ts'
import { runWorkerLoop } from '#checker/check/workerLoop.ts'
import { readCheckerConfig } from '#checker/checkerConfig.ts'
import { STOPPED_REASON } from '#checker/failureReason.ts'
import { createFetcherPreparer } from '#checker/prepare/fetcherPreparer.ts'
import { localPreparer } from '#checker/prepare/localPreparer.ts'
import { waitForFetcher } from '#checker/prepare/waitForFetcher.ts'
import { processRunner } from '#checker/process/processRunner.ts'
import { printable } from '#checker/safeText.ts'

/**
 * Writes a log line to stdout with control characters replaced, since lines carry untrusted
 * text such as registry errors and Claude's reply.
 * @param {string} line - Log line
 * @returns {void}
 */
const log = (line: string): void => {
  console.log(printable(line))
}

/**
 * Waits for a delay, returning early when the signal fires.
 * @param {number} ms - Delay in milliseconds
 * @param {AbortSignal} signal - Stop signal
 * @returns {Promise<void>}
 */
const wait = (ms: number, signal: AbortSignal): Promise<void> =>
  sleep(ms, undefined, { signal }).catch(() => undefined)

/**
 * Reads the configuration, wipes leftovers of an earlier run, waits for the fetcher in
 * two-container mode and polls sieb for checks until SIGTERM or SIGINT, which also abort the
 * running check.
 * @returns {Promise<void>}
 */
const main = async (): Promise<void> => {
  const config = readCheckerConfig(process.env)
  const stop = new AbortController()
  const api = createWorkerApi({ baseUrl: config.workerUrl, secret: config.workerSecret })
  const preparer =
    config.fetcher === null ? localPreparer : createFetcherPreparer(config.fetcher, log)

  process.once('SIGTERM', () => stop.abort(STOPPED_REASON))
  process.once('SIGINT', () => stop.abort(STOPPED_REASON))
  await mkdir(config.workdir, { recursive: true })
  await wipeStaleChecks(config.workdir, log)
  if (config.fetcher !== null) {
    await waitForFetcher(config.fetcher, stop.signal, wait, log)
  }

  const mode =
    config.fetcher === null
      ? `platform ${config.platform}, single container`
      : `fetcher ${config.fetcher.url}, shared workspace ${config.sharedDir}`

  log(
    `[sieb-checker] polling ${config.workerUrl} every ${config.pollSeconds} s ` +
      `(${mode}, work directory ${config.workdir})`,
  )
  await runWorkerLoop({
    api,
    pollMs: config.pollSeconds * 1000,
    stopSignal: stop.signal,
    sleep: wait,
    check: (claim) =>
      runCheck(claim, {
        api,
        runner: processRunner,
        config,
        preparer,
        now: () => performance.now(),
        stopSignal: stop.signal,
        log,
      }),
    log,
  })
  log('[sieb-checker] stopped')
}

main().catch((error: unknown) => {
  console.error(`[sieb-checker] ${printable(errorMessage(error))}`)
  process.exitCode = 1
})
