import { resolve } from 'node:path'

import { MAX_WORKER_POLL_SECONDS } from '#core/checkLimits.ts'
import { parseClaudeEffort, type ClaudeEffort } from '#checker/config/claudeEffort.ts'
import { boundedInt, platformValue, required, workerUrl } from '#checker/config/configValues.ts'
import {
  DEFAULT_SHARED_DIR,
  readFetcherLink,
  type FetcherLink,
} from '#checker/config/fetcherLink.ts'
import { secretValue, type ReadSecretFile } from '#checker/config/secretValue.ts'
import { parseWebDomains } from '#checker/config/webDomains.ts'

/** How Claude Code authenticates: a subscription token or an API key, never both */
export interface ClaudeCredential {
  kind: 'oauth_token' | 'api_key'
  value: string
}

/** Settings of the sieb-checker worker */
export interface CheckerConfig {
  workerUrl: string // base URL of sieb's internal worker API, without trailing slash
  workerSecret: string
  credential: ClaudeCredential
  workdir: string // absolute
  pollSeconds: number
  imageMaxBytes: number // cap on the uncompressed image export
  platform: string
  path: string // PATH handed to the tools and to Claude
  webDomains: string[] // hosts WebFetch may reach
  model: string | null // passed as --model, null keeps the account default
  effort: ClaudeEffort | null // passed as --effort, null keeps Claude Code's default
  fetcher: FetcherLink | null // two-container mode, null pulls public images in this container
  sharedDir: string // absolute mount of the fetcher's shared workspace volume
}

export const DEFAULT_WORKDIR = '/work'
export const DEFAULT_POLL_SECONDS = 10
export const DEFAULT_IMAGE_MAX_BYTES = 4 * 1024 ** 3
const DEFAULT_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
export const MODEL_PATTERN = /^[a-z0-9][a-z0-9.\-[\]]{0,63}$/
const OAUTH_VARIABLE = 'CLAUDE_CODE_OAUTH_TOKEN'
const API_KEY_VARIABLE = 'ANTHROPIC_API_KEY'
// variables that would take precedence over the configured credential in Claude Code
const UNSUPPORTED_VARIABLES = ['ANTHROPIC_AUTH_TOKEN']

/**
 * Reads the Claude credential: exactly one of the subscription token and the API key, each from
 * its variable or its _FILE variant.
 * @param {Record<string, string | undefined>} env - Environment
 * @param {ReadSecretFile} readFile - Reads secret files
 * @returns {ClaudeCredential} - Kind and value
 * @throws {Error} - When none or both are configured
 */
const readCredential = (
  env: Record<string, string | undefined>,
  readFile: ReadSecretFile | undefined,
): ClaudeCredential => {
  const unsupported = UNSUPPORTED_VARIABLES.find((name) => env[name]?.trim())

  if (unsupported) {
    throw new Error(`${unsupported} is not supported, use ${OAUTH_VARIABLE} or ${API_KEY_VARIABLE}`)
  }

  const token = secretValue(env, OAUTH_VARIABLE, readFile)
  const apiKey = secretValue(env, API_KEY_VARIABLE, readFile)

  if (token !== null && apiKey !== null) {
    throw new Error(`configure ${OAUTH_VARIABLE} or ${API_KEY_VARIABLE}, not both`)
  }

  if (token !== null) {
    return { kind: 'oauth_token', value: token }
  }

  if (apiKey !== null) {
    return { kind: 'api_key', value: apiKey }
  }

  throw new Error(`${OAUTH_VARIABLE} or ${API_KEY_VARIABLE} is required, directly or as _FILE`)
}

/**
 * Reads the worker configuration from the environment, secrets preferably from mounted files.
 * @param {Record<string, string | undefined>} env - Environment
 * @param {ReadSecretFile} readFile - Reads secret files, replaced in tests
 * @returns {CheckerConfig} - Validated configuration
 * @throws {Error} - For missing, conflicting or invalid values
 */
export const readCheckerConfig = (
  env: Record<string, string | undefined>,
  readFile?: ReadSecretFile,
): CheckerConfig => {
  const url = workerUrl(required(env, 'SIEB_WORKER_URL'))
  const platform = platformValue(env.SIEB_CHECKER_PLATFORM)

  const model = env.SIEB_CHECKER_MODEL?.trim() || null

  if (model !== null && !MODEL_PATTERN.test(model)) {
    throw new Error(`SIEB_CHECKER_MODEL must be a model alias or id such as opus, got "${model}"`)
  }

  const fetcher = readFetcherLink(env, readFile)
  const workerSecret = secretValue(env, 'SIEB_WORKER_SECRET', readFile)

  if (workerSecret === null) {
    throw new Error('SIEB_WORKER_SECRET is required, directly or as SIEB_WORKER_SECRET_FILE')
  }

  const workdir = resolve(env.SIEB_CHECKER_WORKDIR?.trim() || DEFAULT_WORKDIR)
  const sharedDir = resolve(env.SIEB_CHECKER_SHARED_DIR?.trim() || DEFAULT_SHARED_DIR)

  if (fetcher !== null && sharedDir === workdir) {
    throw new Error('SIEB_CHECKER_SHARED_DIR must differ from SIEB_CHECKER_WORKDIR')
  }

  return {
    workerUrl: url,
    workerSecret,
    credential: readCredential(env, readFile),
    workdir,
    pollSeconds: boundedInt(
      env.SIEB_CHECKER_POLL_SECONDS,
      'SIEB_CHECKER_POLL_SECONDS',
      DEFAULT_POLL_SECONDS,
      MAX_WORKER_POLL_SECONDS,
    ),
    imageMaxBytes: boundedInt(
      env.SIEB_CHECKER_IMAGE_MAX_BYTES,
      'SIEB_CHECKER_IMAGE_MAX_BYTES',
      DEFAULT_IMAGE_MAX_BYTES,
    ),
    platform,
    path: env.PATH?.trim() || DEFAULT_PATH,
    webDomains: parseWebDomains(env.SIEB_CHECKER_WEB_DOMAINS),
    model,
    effort: parseClaudeEffort(env.SIEB_CHECKER_EFFORT),
    fetcher,
    sharedDir,
  }
}
