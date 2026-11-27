import { mkdir } from 'node:fs/promises'
import { once } from 'node:events'

import { errorMessage } from '#core/errorMessage.ts'
import { wipeStaleChecks } from '#checker/check/wipe.ts'
import { fetchCheck, releaseCheck } from '#checker/fetcher/fetchCheck.ts'
import { createFetcherApi } from '#checker/fetcher/fetcherApi.ts'
import { readFetcherConfig } from '#checker/fetcher/fetcherConfig.ts'
import { createFetcherServer } from '#checker/fetcher/fetcherServer.ts'
import { redactTokens } from '#checker/fetcher/redactTokens.ts'
import { setLogProcess } from '#checker/logTag.ts'
import { processRunner } from '#checker/process/processRunner.ts'
import { printable } from '#checker/safeText.ts'

// group read for the checker, nothing for others, on everything the fetcher and its tools write
const SHARED_UMASK = 0o027

/**
 * Writes a log line to stdout with control characters replaced and credential shapes masked.
 * @param {string} line - Log line
 * @returns {void}
 */
const log = (line: string): void => {
  console.log(redactTokens(printable(line)))
}

/**
 * Reads the configuration, wipes leftovers of an earlier run and serves the local endpoint on
 * the loopback address until SIGTERM or SIGINT, which also abort a running preparation.
 * @returns {Promise<void>}
 */
const main = async (): Promise<void> => {
  setLogProcess('sieb-fetcher')

  const config = readFetcherConfig(process.env)
  const api = createFetcherApi({ baseUrl: config.workerUrl, secret: config.fetcherSecret })
  const deps = { api, runner: processRunner, config, log }

  process.umask(SHARED_UMASK)
  await mkdir(config.workdir, { recursive: true })
  await mkdir(config.sharedDir, { recursive: true })
  await wipeStaleChecks(config.sharedDir, log)
  await wipeStaleChecks(config.workdir, log)

  const fetcher = createFetcherServer({
    secret: config.localSecret,
    prepare: (request, signal, onPulled) => fetchCheck(request, signal, onPulled, deps),
    release: (checkId) => releaseCheck(config, checkId, log),
    log,
  })

  fetcher.server.listen(config.port, '127.0.0.1')
  await once(fetcher.server, 'listening')
  log(
    `[sieb-fetcher] listening on 127.0.0.1:${config.port} for the checker, sieb at ` +
      `${config.workerUrl} (platform ${config.platform}, shared workspace ${config.sharedDir})`,
  )
  await Promise.race([once(process, 'SIGTERM'), once(process, 'SIGINT')])
  await fetcher.stop()
  log('[sieb-fetcher] stopped')
}

main().catch((error: unknown) => {
  console.error(`[sieb-fetcher] ${redactTokens(printable(errorMessage(error)))}`)
  process.exitCode = 1
})
