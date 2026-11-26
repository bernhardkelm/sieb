import { KEV_SOURCES, type KevSourceKind } from '#core/kev.ts'
import { DEFAULT_PUBLIC_REGISTRIES } from '#core/sourceAccess.ts'
import { DEFAULT_USER_HEADER } from '#server/http/identity.ts'
import { DEFAULT_PROMETHEUS_SERVICE } from '#server/sources/sourceQueries.ts'

export const DEFAULT_PROMETHEUS_URL = 'http://kube-prometheus-stack-prometheus.monitoring.svc:9090'
export const DEFAULT_KEV_URL =
  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'

const NAME_SEGMENT = '[a-z0-9]([-a-z0-9]*[a-z0-9])?'
const PROMETHEUS_SERVICE_PATTERN = new RegExp(`^${NAME_SEGMENT}/${NAME_SEGMENT}:${NAME_SEGMENT}$`)
const HEADER_NAME_PATTERN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/
const REGISTRY_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/

/**
 * Parses a positive integer setting.
 * @param {string | undefined} value - Raw value
 * @param {string} name - Variable name for the error message
 * @param {number} fallback - Value when unset
 * @param {number} max - Largest allowed value
 * @returns {number} - Parsed integer
 * @throws {Error} - When the value is not an integer between 1 and max
 */
export const parsePositiveInt = (
  value: string | undefined,
  name: string,
  fallback: number,
  max: number,
): number => {
  const parsed = Number(value || fallback)

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}, got "${value}"`)
  }

  return parsed
}

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
 * Validates an http or https URL setting.
 * @param {string | undefined} value - Raw value
 * @param {string} name - Variable name for the error message
 * @param {string} fallback - URL when unset or blank
 * @returns {string} - URL
 * @throws {Error} - When the value is not an http or https URL
 */
export const parseHttpUrl = (value: string | undefined, name: string, fallback: string): string => {
  const url = value?.trim() || fallback

  if (!URL.canParse(url) || !['http:', 'https:'].includes(new URL(url).protocol)) {
    throw new Error(`${name} must be an http or https URL, got "${value}"`)
  }

  return url
}

/**
 * Validates the Prometheus base URL of the incluster source.
 * @param {string | undefined} value - Raw SIEB_PROMETHEUS_URL value
 * @returns {string} - URL
 * @throws {Error} - When the value is not an http or https URL
 */
export const parsePrometheusUrl = (value: string | undefined): string =>
  parseHttpUrl(value, 'SIEB_PROMETHEUS_URL', DEFAULT_PROMETHEUS_URL)

/**
 * Validates the URL of the CISA KEV feed or a mirror of it.
 * @param {string | undefined} value - Raw SIEB_KEV_URL value
 * @returns {string} - URL, the CISA feed when unset
 * @throws {Error} - When the value is not an http or https URL
 */
export const parseKevUrl = (value: string | undefined): string =>
  parseHttpUrl(value, 'SIEB_KEV_URL', DEFAULT_KEV_URL)

/**
 * Parses the KEV source.
 * @param {string | undefined} value - Raw SIEB_KEV_SOURCE value
 * @returns {KevSourceKind} - KEV source, cisa when unset or blank
 * @throws {Error} - For an unknown KEV source
 */
export const parseKevSource = (value: string | undefined): KevSourceKind => {
  const source = value?.trim() || 'cisa'

  if (!(KEV_SOURCES as readonly string[]).includes(source)) {
    throw new Error(`SIEB_KEV_SOURCE must be one of ${KEV_SOURCES.join(', ')}, got "${value}"`)
  }

  return source as KevSourceKind
}

/**
 * Validates the name of the username header.
 * @param {string | undefined} value - Raw SIEB_USER_HEADER value
 * @returns {string} - Header name
 * @throws {Error} - When the value is not a valid header name
 */
export const parseUserHeader = (value: string | undefined): string => {
  const header = value?.trim() || DEFAULT_USER_HEADER

  if (!HEADER_NAME_PATTERN.test(header)) {
    throw new Error(`SIEB_USER_HEADER must be a valid header name, got "${value}"`)
  }

  return header
}

/**
 * Parses a comma separated host list.
 * @param {string | undefined} value - Raw SIEB_ALLOWED_HOSTS value
 * @returns {string[]} - Trimmed, lower-cased, non-empty entries
 */
export const parseHostList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host !== '')

/**
 * Parses a boolean setting.
 * @param {string | undefined} value - Raw value
 * @param {string} name - Variable name for the error message
 * @param {boolean} fallback - Value when unset or blank
 * @returns {boolean} - True for true or 1, false for false or 0
 * @throws {Error} - For any other value
 */
export const parseBoolean = (
  value: string | undefined,
  name: string,
  fallback: boolean,
): boolean => {
  const raw = value?.trim().toLowerCase() ?? ''

  if (raw === '') {
    return fallback
  }

  if (raw === 'true' || raw === '1') {
    return true
  }

  if (raw === 'false' || raw === '0') {
    return false
  }

  throw new Error(`${name} must be true, false, 1 or 0, got "${value}"`)
}

/**
 * Parses the registries whose images count as public for the source access of a finding.
 * @param {string | undefined} value - Raw SIEB_PUBLIC_REGISTRIES value, comma separated hosts
 * @returns {string[]} - Lower-case hosts, DEFAULT_PUBLIC_REGISTRIES when unset or blank
 * @throws {Error} - For an entry that is not a registry host with an optional port
 */
export const parseRegistryList = (value: string | undefined): string[] => {
  const entries = (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '')

  if (entries.length === 0) {
    return [...DEFAULT_PUBLIC_REGISTRIES]
  }

  const invalid = entries.find((entry) => !REGISTRY_PATTERN.test(entry))

  if (invalid !== undefined) {
    throw new Error(
      `SIEB_PUBLIC_REGISTRIES must list registry hosts such as ghcr.io, got "${invalid}"`,
    )
  }

  return [...new Set(entries)]
}
