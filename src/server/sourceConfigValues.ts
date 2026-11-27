import { resolve } from 'node:path'

import type { SourceKind } from '#core/types.ts'
import {
  DEFAULT_PROMETHEUS_SERVICE,
  DEFAULT_SOURCE_QUERIES,
  type SourceQueries,
} from '#server/sources/sourceQueries.ts'
import { parseHttpUrl } from '#server/urlConfigValues.ts'

export const LIVE_DB_PATH = 'data/sieb.db'
export const MOCK_DB_PATH = 'data/sieb-mock.db'
export const DEFAULT_PROMETHEUS_URL = 'http://kube-prometheus-stack-prometheus.monitoring.svc:9090'

const SOURCES: readonly SourceKind[] = ['mock', 'kubectl', 'incluster']
const NAME_SEGMENT = '[a-z0-9]([-a-z0-9]*[a-z0-9])?'
const PROMETHEUS_SERVICE_PATTERN = new RegExp(`^${NAME_SEGMENT}/${NAME_SEGMENT}:${NAME_SEGMENT}$`)

/**
 * Parses the data source.
 * @param {string | undefined} value - Raw SIEB_SOURCE value
 * @returns {SourceKind} - Source, kubectl when unset
 * @throws {Error} - For an unknown source
 */
export const parseSource = (value: string | undefined): SourceKind => {
  const source = value || 'kubectl'

  if (!(SOURCES as readonly string[]).includes(source)) {
    throw new Error(`SIEB_SOURCE must be one of ${SOURCES.join(', ')}, got "${value}"`)
  }

  return source as SourceKind
}

/**
 * Resolves the database path. Mock mode never opens the live database file.
 * @param {string | undefined} value - Raw SIEB_DB_PATH value
 * @param {SourceKind} source - Data source
 * @param {string} cwd - Directory relative paths resolve against
 * @returns {string} - Absolute path
 * @throws {Error} - When mock mode points at the live database
 */
export const resolveDbPath = (
  value: string | undefined,
  source: SourceKind,
  cwd: string,
): string => {
  const mock = source === 'mock'
  const path = resolve(cwd, value || (mock ? MOCK_DB_PATH : LIVE_DB_PATH))

  if (mock && path === resolve(cwd, LIVE_DB_PATH)) {
    throw new Error(`SIEB_SOURCE=mock must not use ${LIVE_DB_PATH}, unset SIEB_DB_PATH`)
  }

  return path
}

/**
 * Reads the two Prometheus queries, an unset or blank value keeps the default.
 * @param {Record<string, string | undefined>} env - Environment
 * @returns {SourceQueries} - Findings and KEV query
 */
export const parseQueries = (env: Record<string, string | undefined>): SourceQueries => ({
  findings: env.SIEB_FINDINGS_QUERY?.trim() || DEFAULT_SOURCE_QUERIES.findings,
  kev: env.SIEB_KEV_QUERY?.trim() || DEFAULT_SOURCE_QUERIES.kev,
})

/**
 * Validates the Prometheus service of the kubectl source.
 * @param {string | undefined} value - Raw SIEB_PROMETHEUS_SERVICE value
 * @returns {string} - Service as namespace/name:port
 * @throws {Error} - When the value does not have the namespace/name:port shape
 */
export const parsePrometheusService = (value: string | undefined): string => {
  const service = value?.trim() || DEFAULT_PROMETHEUS_SERVICE

  if (!PROMETHEUS_SERVICE_PATTERN.test(service)) {
    throw new Error(`SIEB_PROMETHEUS_SERVICE must look like namespace/name:port, got "${value}"`)
  }

  return service
}

/**
 * Validates the Prometheus base URL of the incluster source.
 * @param {string | undefined} value - Raw SIEB_PROMETHEUS_URL value
 * @returns {string} - URL
 * @throws {Error} - When the value is not an http or https URL
 */
export const parsePrometheusUrl = (value: string | undefined): string =>
  parseHttpUrl(value, 'SIEB_PROMETHEUS_URL', DEFAULT_PROMETHEUS_URL)
