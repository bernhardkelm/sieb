import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

import type { AuthMode } from '#core/authApiTypes.ts'
import type { KevSourceKind } from '#core/kev.ts'
import type { SourceKind } from '#core/types.ts'
import { readCheckConfig, type CheckConfig } from '#server/checkConfigValues.ts'
import {
  parseBoolean,
  parseHostList,
  parseKevSource,
  parseKevUrl,
  parsePositiveInt,
  parseRegistryList,
  parseUserHeader,
} from '#server/configValues.ts'
import { readCredentialsKey } from '#server/credentialConfigValues.ts'
import { readOAuthConfig, type OAuthConfig } from '#server/mcpConfigValues.ts'
import { parseAuthMode, readOidcConfig, type OidcConfig } from '#server/oidcConfigValues.ts'
import { MAX_PORT, parseMetricsPort } from '#server/portConfigValues.ts'
import { parseSourceCodeUrl } from '#server/sourceCodeUrl.ts'
import {
  parsePrometheusService,
  parsePrometheusUrl,
  parseQueries,
  parseSource,
  resolveDbPath,
} from '#server/sourceConfigValues.ts'
import type { SourceQueries } from '#server/sources/sourceQueries.ts'
import { parseOriginList, parsePublicUrl } from '#server/urlConfigValues.ts'

export const STATIC_DIR = 'dist'
export const DEFAULT_PORT = 3100
export const DEFAULT_DEV_USER = 'dev'
export const DEFAULT_SYNC_INTERVAL_MINUTES = 15
export const MAX_SYNC_INTERVAL_MINUTES = 24 * 60

export interface ServerConfig {
  source: SourceKind
  production: boolean
  host: string
  port: number
  metricsPort: number | null // separate /metrics listener, null serves /metrics on port
  dbPath: string // absolute path
  kubeContext: string | null // null uses the current kubectl context
  prometheusService: string // namespace/name:port behind the API server service proxy
  prometheusUrl: string
  queries: SourceQueries
  kevSource: KevSourceKind
  kevUrl: string // CISA KEV feed or a mirror, fetched by the cisa KEV source
  syncIntervalMinutes: number
  authMode: AuthMode // header trusts the forward-auth header, oidc runs sieb's own login
  oidc: OidcConfig | null // login settings, null in header mode
  devUser: string | null // acting user without an auth header, null in production and oidc mode
  userHeader: string // request header carrying the authenticated username
  allowedHosts: string[] // Host values accepted besides loopback, lower case
  staticDir: string | null // absolute path of the built client, null when dist/ is missing
  mcpEnabled: boolean // MCP endpoint, OAuth metadata and personal tokens, off by default
  publicUrl: string | null // origin sieb is reached at, https in production, null derives it per request
  mcpAllowedOrigins: string[] // browser origins /mcp accepts besides the requested host
  oauth: OAuthConfig | null // null accepts personal tokens only on /mcp, always null while MCP is off
  publicRegistries: string[] // registry hosts whose images count as public for source access
  sourceCodeUrl: string | null // source code link of a fork, null links the upstream release tag
  checks: CheckConfig | null // Auto-check queue and worker listener, null while SIEB_CHECKS_ENABLED is off
  credentialsKey: Buffer | null // seals stored access credentials, null turns private access off
}

/**
 * Reads the server configuration from the environment. NODE_ENV=production, and the incluster
 * source even without it, refuse the mock source and disable the dev user, so a deployment never
 * answers with fixtures or acts without an auth header. The built client is served whenever
 * dist/index.html exists. OAuth for /mcp needs the public URL and is ignored while MCP is off.
 * SIEB_AUTH=oidc needs the OIDC client, the public URL and the metrics port, and never uses the
 * dev user, not even outside production. Its client must differ from the MCP OAuth client, whose
 * access tokens /mcp accepts by audience. SIEB_CHECKS_ENABLED needs MCP, the public URL, the
 * worker port and the worker secret. A malformed SIEB_CREDENTIALS_KEY refuses to start.
 * @param {Record<string, string | undefined>} env - Environment
 * @param {string} cwd - Directory relative paths resolve against
 * @returns {ServerConfig} - Validated configuration
 * @throws {Error} - For invalid values and for the mock source in production
 */
export const readConfig = (env: Record<string, string | undefined>, cwd: string): ServerConfig => {
  const source = parseSource(env.SIEB_SOURCE)
  const production = env.NODE_ENV === 'production' || source === 'incluster'

  if (production && source === 'mock') {
    throw new Error('SIEB_SOURCE=mock must not be used with NODE_ENV=production')
  }

  const staticDir = resolve(cwd, STATIC_DIR)
  const publicUrl = parsePublicUrl(env.SIEB_PUBLIC_URL, production)
  const mcpEnabled = parseBoolean(env.SIEB_MCP_ENABLED, 'SIEB_MCP_ENABLED', false)
  const port = parsePositiveInt(env.SIEB_PORT, 'SIEB_PORT', DEFAULT_PORT, MAX_PORT)
  const metricsPort = parseMetricsPort(env.SIEB_METRICS_PORT, port)
  const authMode = parseAuthMode(env.SIEB_AUTH)
  const oidc =
    authMode === 'oidc' ? readOidcConfig(env, { publicUrl, metricsPort, production }) : null
  const oauth = mcpEnabled ? readOAuthConfig(env, publicUrl, production) : null

  if (oidc !== null && oauth !== null && oidc.clientId === oauth.clientId) {
    throw new Error('SIEB_OIDC_CLIENT_ID and SIEB_OAUTH_CLIENT_ID must name separate clients')
  }

  return {
    source,
    production,
    host: env.SIEB_HOST || '127.0.0.1',
    port,
    metricsPort,
    dbPath: resolveDbPath(env.SIEB_DB_PATH, source, cwd),
    kubeContext: env.SIEB_KUBE_CONTEXT?.trim() || null,
    prometheusService: parsePrometheusService(env.SIEB_PROMETHEUS_SERVICE),
    prometheusUrl: parsePrometheusUrl(env.SIEB_PROMETHEUS_URL),
    queries: parseQueries(env),
    kevSource: parseKevSource(env.SIEB_KEV_SOURCE),
    kevUrl: parseKevUrl(env.SIEB_KEV_URL),
    syncIntervalMinutes: parsePositiveInt(
      env.SIEB_SYNC_INTERVAL_MINUTES,
      'SIEB_SYNC_INTERVAL_MINUTES',
      DEFAULT_SYNC_INTERVAL_MINUTES,
      MAX_SYNC_INTERVAL_MINUTES,
    ),
    authMode,
    oidc,
    devUser: production || oidc !== null ? null : env.SIEB_DEV_USER?.trim() || DEFAULT_DEV_USER,
    userHeader: parseUserHeader(env.SIEB_USER_HEADER),
    allowedHosts: parseHostList(env.SIEB_ALLOWED_HOSTS),
    staticDir: existsSync(join(staticDir, 'index.html')) ? staticDir : null,
    mcpEnabled,
    publicUrl,
    mcpAllowedOrigins: parseOriginList(env.SIEB_MCP_ALLOWED_ORIGINS),
    oauth,
    publicRegistries: parseRegistryList(env.SIEB_PUBLIC_REGISTRIES),
    sourceCodeUrl: parseSourceCodeUrl(env.SIEB_SOURCE_URL),
    checks: readCheckConfig(env, { mcpEnabled, publicUrl, port, metricsPort }),
    credentialsKey: readCredentialsKey(env),
  }
}
