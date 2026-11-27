import { resolve } from 'node:path'

import { boundedInt, platformValue, required, workerUrl } from '#checker/config/configValues.ts'
import { DEFAULT_SHARED_DIR, localSecret } from '#checker/config/fetcherLink.ts'
import { secretValue, type ReadSecretFile } from '#checker/config/secretValue.ts'
import type { ToolConfig } from '#checker/workspace/runTool.ts'

/** Settings of the sieb-fetcher container */
export interface FetcherConfig extends ToolConfig {
  workerUrl: string // base URL of sieb's worker listener, without trailing slash
  fetcherSecret: string // bearer of sieb's fetcher routes, never leaves this container
  localSecret: string // shared with the checker for the loopback endpoint
  port: number // loopback port of the local endpoint
  workdir: string // private: HOME, TMPDIR, DOCKER_CONFIG and syft output, absolute
  sharedDir: string // the workspace volume the checker mounts read-only, absolute
  sourceMaxBytes: number // cap on the checked-out source tree
}

export const DEFAULT_FETCHER_PORT = 3102
export const DEFAULT_SOURCE_MAX_BYTES = 512 * 1024 ** 2
const DEFAULT_IMAGE_MAX_BYTES = 4 * 1024 ** 3
const DEFAULT_WORKDIR = '/work'
const DEFAULT_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
const MAX_PORT = 65535
// secrets of the checker, the fetcher's tools parse untrusted content and must not reach them
const CHECKER_SECRETS = [
  'SIEB_WORKER_SECRET',
  'ANTHROPIC_API_KEY',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'ANTHROPIC_AUTH_TOKEN',
]

/**
 * Refuses an environment that holds a secret of the checker, directly or as a _FILE variant,
 * as a shared envFrom of both containers would.
 * @param {Record<string, string | undefined>} env - Environment
 * @returns {void}
 * @throws {Error} - Naming the first such variable, never its value
 */
const refuseCheckerSecrets = (env: Record<string, string | undefined>): void => {
  const held = CHECKER_SECRETS.flatMap((name) => [name, `${name}_FILE`]).find((name) =>
    env[name]?.trim(),
  )

  if (held !== undefined) {
    throw new Error(`${held} belongs to the checker container, the fetcher must not hold it`)
  }
}

/**
 * Reads the fetcher configuration from the environment, secrets preferably from mounted files,
 * and refuses to start with a secret of the checker.
 * @param {Record<string, string | undefined>} env - Environment
 * @param {ReadSecretFile} readFile - Reads secret files, replaced in tests
 * @returns {FetcherConfig} - Validated configuration
 * @throws {Error} - For missing, conflicting or invalid values
 */
export const readFetcherConfig = (
  env: Record<string, string | undefined>,
  readFile?: ReadSecretFile,
): FetcherConfig => {
  const url = workerUrl(required(env, 'SIEB_WORKER_URL'))

  refuseCheckerSecrets(env)

  const platform = platformValue(env.SIEB_CHECKER_PLATFORM)
  const fetcherSecret = secretValue(env, 'SIEB_FETCHER_SECRET', readFile)

  if (fetcherSecret === null) {
    throw new Error('SIEB_FETCHER_SECRET is required, directly or as SIEB_FETCHER_SECRET_FILE')
  }

  const local = localSecret(env, readFile)

  if (local === null) {
    throw new Error(
      'SIEB_FETCHER_LOCAL_SECRET is required, directly or as SIEB_FETCHER_LOCAL_SECRET_FILE',
    )
  }

  const workdir = resolve(env.SIEB_CHECKER_WORKDIR?.trim() || DEFAULT_WORKDIR)
  const sharedDir = resolve(env.SIEB_CHECKER_SHARED_DIR?.trim() || DEFAULT_SHARED_DIR)

  if (workdir === sharedDir) {
    throw new Error('SIEB_CHECKER_SHARED_DIR must differ from SIEB_CHECKER_WORKDIR')
  }

  return {
    workerUrl: url,
    fetcherSecret,
    localSecret: local,
    port: boundedInt(env.SIEB_FETCHER_PORT, 'SIEB_FETCHER_PORT', DEFAULT_FETCHER_PORT, MAX_PORT),
    workdir,
    sharedDir,
    path: env.PATH?.trim() || DEFAULT_PATH,
    platform,
    imageMaxBytes: boundedInt(
      env.SIEB_CHECKER_IMAGE_MAX_BYTES,
      'SIEB_CHECKER_IMAGE_MAX_BYTES',
      DEFAULT_IMAGE_MAX_BYTES,
    ),
    sourceMaxBytes: boundedInt(
      env.SIEB_CHECKER_SOURCE_MAX_BYTES,
      'SIEB_CHECKER_SOURCE_MAX_BYTES',
      DEFAULT_SOURCE_MAX_BYTES,
    ),
  }
}
