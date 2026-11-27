import type { AuthMode } from '#core/authApiTypes.ts'
import { parsePositiveInt } from '#server/configValues.ts'
import { parseWebUrl } from '#server/urlConfigValues.ts'

export const AUTH_MODES: readonly AuthMode[] = ['header', 'oidc']
export const DEFAULT_SESSION_HOURS = 12
export const MAX_SESSION_HOURS = 7 * 24
export const DEFAULT_OIDC_DISPLAY_NAME = 'SSO'

/** Built-in UI login of the oidc auth mode, a confidential client of the issuer */
export interface OidcConfig {
  issuer: string // exact issuer, also the base of the OpenID discovery document
  clientId: string
  clientSecret: string // never logged
  requiredGroup: string | null // groups claim entry a user must have, null admits every user
  sessionHours: number // absolute session lifetime
  displayName: string // provider name on the sign-in button
}

/**
 * Parses the auth mode.
 * @param {string | undefined} value - Raw SIEB_AUTH value
 * @returns {AuthMode} - Mode, header when unset or blank
 * @throws {Error} - For an unknown mode
 */
export const parseAuthMode = (value: string | undefined): AuthMode => {
  const mode = value?.trim().toLowerCase() || 'header'

  if (!(AUTH_MODES as readonly string[]).includes(mode)) {
    throw new Error(`SIEB_AUTH must be one of ${AUTH_MODES.join(', ')}, got "${value}"`)
  }

  return mode as AuthMode
}

/**
 * Reads a setting the oidc mode cannot run without.
 * @param {Record<string, string | undefined>} env - Environment
 * @param {string} name - Variable name
 * @returns {string} - Trimmed value
 * @throws {Error} - When unset or blank, naming the variable only
 */
const required = (env: Record<string, string | undefined>, name: string): string => {
  const value = env[name]?.trim() ?? ''

  if (value === '') {
    throw new Error(`${name} must be set when SIEB_AUTH=oidc`)
  }

  return value
}

/**
 * Reads the OIDC login settings of the oidc auth mode, which also needs the public URL for the
 * redirect URI and the separate metrics listener, so /metrics never answers on the public port.
 * @param {Record<string, string | undefined>} env - Environment
 * @param {{ publicUrl: string | null; metricsPort: number | null; production: boolean }} context - Parsed public URL and metrics port, production flag
 * @returns {OidcConfig} - Settings
 * @throws {Error} - For missing or invalid settings, never with the client secret in the message
 */
export const readOidcConfig = (
  env: Record<string, string | undefined>,
  {
    publicUrl,
    metricsPort,
    production,
  }: { publicUrl: string | null; metricsPort: number | null; production: boolean },
): OidcConfig => {
  const issuer = required(env, 'SIEB_OIDC_ISSUER')
  const clientId = required(env, 'SIEB_OIDC_CLIENT_ID')
  const clientSecret = required(env, 'SIEB_OIDC_CLIENT_SECRET')

  if (publicUrl === null) {
    throw new Error('SIEB_PUBLIC_URL must be set when SIEB_AUTH=oidc')
  }

  if (metricsPort === null) {
    throw new Error('SIEB_METRICS_PORT must be set when SIEB_AUTH=oidc')
  }

  parseWebUrl(issuer, 'SIEB_OIDC_ISSUER', production)

  return {
    issuer,
    clientId,
    clientSecret,
    requiredGroup: env.SIEB_OIDC_REQUIRED_GROUP?.trim() || null,
    sessionHours: parsePositiveInt(
      env.SIEB_SESSION_HOURS?.trim(),
      'SIEB_SESSION_HOURS',
      DEFAULT_SESSION_HOURS,
      MAX_SESSION_HOURS,
    ),
    displayName: env.SIEB_OIDC_DISPLAY_NAME?.trim() || DEFAULT_OIDC_DISPLAY_NAME,
  }
}
