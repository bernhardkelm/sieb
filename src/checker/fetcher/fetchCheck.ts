import { mkdir } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'

import type { FetchAccess } from '#core/privateAccess.ts'
import { errorMessage } from '#core/errorMessage.ts'
import { CheckFailure } from '#checker/CheckFailure.ts'
import { wipeCheckDir, wipeStaleChecks } from '#checker/check/wipe.ts'
import { removeDockerConfig, writeDockerConfig } from '#checker/fetcher/dockerConfig.ts'
import type { FetcherApi } from '#checker/fetcher/fetcherApi.ts'
import type { FetcherConfig } from '#checker/fetcher/fetcherConfig.ts'
import { fetchLayout, type FetchLayout } from '#checker/fetcher/fetchLayout.ts'
import { withRefusedLogin } from '#checker/fetcher/refusedLogin.ts'
import { createSecretList } from '#checker/fetcher/secretList.ts'
import type { PrepareAnswer, PrepareRequest } from '#checker/prepare/prepareTypes.ts'
import type { ProcessRunner } from '#checker/process/processRunner.ts'
import { fetchSource } from '#checker/source/fetchSource.ts'
import {
  pullImages,
  writeInventories,
  type WorkspaceImages,
} from '#checker/workspace/prepareWorkspace.ts'
import { resolveImages, type PulledImage } from '#checker/workspace/resolveImage.ts'
import type { ToolContext } from '#checker/workspace/runTool.ts'

/** What the fetcher needs to prepare a check */
export interface FetchDeps {
  api: FetcherApi
  runner: ProcessRunner
  config: FetcherConfig
  log: (line: string) => void
  now?: () => number // monotonic milliseconds
  pollMs?: number // interval of the source size watch
}

/**
 * Pulls the images sieb names with the check's registry logins in DOCKER_CONFIG, and removes
 * that directory again before anything else runs. The images the checker names are ignored. A
 * refused login names the credential by its label.
 * @param {FetchAccess} access - Logins and the claim's images
 * @param {PrepareRequest} request - Check id
 * @param {FetchLayout} layout - Paths of the check
 * @param {ToolContext} context - Runner, config, abort signal, deadline and log
 * @param {(images: PulledImage[]) => void} onPulled - Receives the primary image once it is exported
 * @returns {Promise<WorkspaceImages>} - Pulled and skipped images
 * @throws {CheckFailure} - When the primary image cannot be pulled
 */
const pullWithAccess = async (
  access: FetchAccess,
  request: PrepareRequest,
  layout: FetchLayout,
  context: ToolContext,
  onPulled: (images: PulledImage[]) => void,
): Promise<WorkspaceImages> => {
  await writeDockerConfig(layout.dockerConfig, access.registries)

  try {
    return await withRefusedLogin(access.registries, access.images[0]!.imageRef, async () => {
      const resolved = await resolveImages(access.images, layout, context)

      return await pullImages(request.checkId, resolved, layout, context, onPulled)
    })
  } finally {
    await removeDockerConfig(layout.dockerConfig)
  }
}

/**
 * Removes the directories of one check from the shared and the private work directory.
 * @param {FetcherConfig} config - Fetcher configuration
 * @param {number} checkId - Check id
 * @param {(line: string) => void} log - Log writer
 * @returns {Promise<void>}
 */
export const releaseCheck = async (
  config: FetcherConfig,
  checkId: number,
  log: (line: string) => void,
): Promise<void> => {
  const layout = fetchLayout(config.workdir, config.sharedDir, checkId)

  await wipeCheckDir(layout.workspace, log)
  await wipeCheckDir(layout.privateRoot, log)
}

/**
 * Prepares the shared workspace of one check: removes what earlier checks left, fetches the
 * registry logins from sieb, pulls the images, writes their inventories after the logins are
 * gone, and checks out the source of the primary image. Error texts and log lines never carry a
 * login of the check.
 * @param {PrepareRequest} request - Check id, images and time left
 * @param {AbortSignal} signal - Fires when the checker gives up the request or the fetcher stops
 * @param {(images: PulledImage[]) => void} onPulled - Receives the primary image once it is exported
 * @param {FetchDeps} deps - sieb client, runner, config and log
 * @returns {Promise<PrepareAnswer>} - Images and source outcome
 * @throws {CheckFailure} - When the primary image cannot be pulled, with a redacted reason
 */
export const fetchCheck = async (
  request: PrepareRequest,
  signal: AbortSignal,
  onPulled: (images: PulledImage[]) => void,
  deps: FetchDeps,
): Promise<PrepareAnswer> => {
  const { config } = deps
  const now = deps.now ?? (() => performance.now())
  const deadline = now() + request.timeoutMs
  const layout = fetchLayout(config.workdir, config.sharedDir, request.checkId)
  const secrets = createSecretList()

  /**
   * Writes a log line without the logins of the check.
   * @param {string} line - Log line
   * @returns {void}
   */
  const log = (line: string): void => deps.log(secrets.redact(line))
  /**
   * Returns the time left until the check deadline.
   * @returns {number} - Milliseconds, negative once it passed
   */
  const remainingMs = (): number => deadline - now()
  const context: ToolContext = { runner: deps.runner, config, signal, log, remainingMs }

  try {
    await wipeStaleChecks(config.sharedDir, log)
    await wipeStaleChecks(config.workdir, log)
    await mkdir(layout.images, { recursive: true, mode: 0o750 })
    await mkdir(layout.home, { recursive: true, mode: 0o700 })
    await mkdir(layout.tmp, { recursive: true, mode: 0o700 })

    const access = await deps.api.access(request.checkId)

    access.registries.forEach(({ username, secret }) => secrets.add(username, secret))

    const images = await pullWithAccess(access, request, layout, context, onPulled)

    await writeInventories(images, { ...layout, dockerConfig: null }, context)

    const source = await fetchSource(request.checkId, images.prepared[0]!, {
      ...context,
      api: deps.api,
      config,
      layout,
      secrets,
      pollMs: deps.pollMs,
    })

    return { images, source }
  } catch (error) {
    throw error instanceof CheckFailure
      ? new CheckFailure(secrets.redact(error.message))
      : new Error(secrets.redact(errorMessage(error)))
  }
}
