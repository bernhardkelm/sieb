import {
  DEFAULT_CHECK_MAX_TURNS,
  DEFAULT_CHECK_TIMEOUT_SECONDS,
  MAX_CHECK_MAX_TURNS,
  MAX_CHECK_TIMEOUT_SECONDS,
} from '#core/checkLimits.ts'
import { parseBoolean, parsePositiveInt } from '#server/configValues.ts'
import { parseWorkerPort } from '#server/portConfigValues.ts'
import { readSecretSetting } from '#server/secretSetting.ts'

export const MIN_WORKER_SECRET_LENGTH = 32

/** Auto-check settings, the worker listener and what a claim hands the worker */
export interface CheckConfig {
  workerPort: number // separate listener serving only /worker
  workerSecret: string // bearer secret of the worker, never logged
  fetcherSecret: string | null // bearer secret of the fetcher, never logged, null keeps private images ineligible
  timeoutSeconds: number
  maxTurns: number
}

/**
 * Reads the worker secret, at least MIN_WORKER_SECRET_LENGTH characters without whitespace.
 * @param {string | undefined} value - Raw SIEB_WORKER_SECRET value
 * @returns {string} - Secret
 * @throws {Error} - When missing or too weak, never with the secret in the message
 */
const parseWorkerSecret = (value: string | undefined): string => {
  const secret = value ?? ''

  if (secret.length < MIN_WORKER_SECRET_LENGTH || /\s/.test(secret)) {
    throw new Error(
      `SIEB_WORKER_SECRET must be set to at least ${MIN_WORKER_SECRET_LENGTH} characters ` +
        'without whitespace when SIEB_CHECKS_ENABLED=true',
    )
  }

  return secret
}

/**
 * Reads the fetcher secret from SIEB_FETCHER_SECRET or SIEB_FETCHER_SECRET_FILE: at least
 * MIN_WORKER_SECRET_LENGTH characters without whitespace and not the worker secret, so the
 * checker that runs Claude can never ask for credentials.
 * @param {Record<string, string | undefined>} env - Environment
 * @param {string} workerSecret - SIEB_WORKER_SECRET
 * @returns {string | null} - Secret, null when unset
 * @throws {Error} - When too weak or equal to the worker secret, never with the secret in the message
 */
const parseFetcherSecret = (
  env: Record<string, string | undefined>,
  workerSecret: string,
): string | null => {
  const secret = readSecretSetting(env, 'SIEB_FETCHER_SECRET')

  if (secret === null) {
    return null
  }

  if (secret.length < MIN_WORKER_SECRET_LENGTH || /\s/.test(secret)) {
    throw new Error(
      `SIEB_FETCHER_SECRET must be at least ${MIN_WORKER_SECRET_LENGTH} characters without whitespace`,
    )
  }

  if (secret === workerSecret) {
    throw new Error('SIEB_FETCHER_SECRET must differ from SIEB_WORKER_SECRET')
  }

  return secret
}

/**
 * Reads the Auto-check settings. The worker files proposals through /mcp with a personal token
 * and needs its absolute URL, so checks need MCP and the public URL.
 * @param {Record<string, string | undefined>} env - Environment
 * @param {{ mcpEnabled: boolean; publicUrl: string | null; port: number; metricsPort: number | null }} context - Parsed MCP flag, public URL, main and metrics port
 * @returns {CheckConfig | null} - Settings, null while SIEB_CHECKS_ENABLED is off
 * @throws {Error} - For missing or invalid settings
 */
export const readCheckConfig = (
  env: Record<string, string | undefined>,
  context: {
    mcpEnabled: boolean
    publicUrl: string | null
    port: number
    metricsPort: number | null
  },
): CheckConfig | null => {
  if (!parseBoolean(env.SIEB_CHECKS_ENABLED, 'SIEB_CHECKS_ENABLED', false)) {
    return null
  }

  if (!context.mcpEnabled || context.publicUrl === null) {
    throw new Error('SIEB_CHECKS_ENABLED needs SIEB_MCP_ENABLED=true and SIEB_PUBLIC_URL')
  }

  const workerSecret = parseWorkerSecret(env.SIEB_WORKER_SECRET)

  return {
    workerPort: parseWorkerPort(env.SIEB_WORKER_PORT, context),
    workerSecret,
    fetcherSecret: parseFetcherSecret(env, workerSecret),
    timeoutSeconds: parsePositiveInt(
      env.SIEB_CHECK_TIMEOUT_SECONDS?.trim(),
      'SIEB_CHECK_TIMEOUT_SECONDS',
      DEFAULT_CHECK_TIMEOUT_SECONDS,
      MAX_CHECK_TIMEOUT_SECONDS,
    ),
    maxTurns: parsePositiveInt(
      env.SIEB_CHECK_MAX_TURNS?.trim(),
      'SIEB_CHECK_MAX_TURNS',
      DEFAULT_CHECK_MAX_TURNS,
      MAX_CHECK_MAX_TURNS,
    ),
  }
}
