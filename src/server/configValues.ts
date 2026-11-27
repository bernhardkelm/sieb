import { KEV_SOURCES, type KevSourceKind } from '#core/kev.ts'
import { DEFAULT_PUBLIC_REGISTRIES } from '#core/sourceAccess.ts'
import { DEFAULT_USER_HEADER } from '#server/http/identity.ts'
import { parseHttpUrl } from '#server/urlConfigValues.ts'

export const DEFAULT_KEV_URL =
  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'

const HEADER_NAME_PATTERN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/
const REGISTRY_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/

/**
 * Parses an integer between 1 and max.
 * @param {string} value - Raw, non-empty value
 * @param {string} name - Variable name for the error message
 * @param {number} max - Largest allowed value
 * @returns {number} - Parsed integer
 * @throws {Error} - When the value is not an integer between 1 and max
 */
export const parseIntUpTo = (value: string, name: string, max: number): number => {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}, got "${value}"`)
  }

  return parsed
}

/**
 * Parses a positive integer setting.
 * @param {string | undefined} value - Raw value
 * @param {string} name - Variable name for the error message
 * @param {number} fallback - Value when unset or empty
 * @param {number} max - Largest allowed value
 * @returns {number} - Parsed integer
 * @throws {Error} - When the value is not an integer between 1 and max
 */
export const parsePositiveInt = (
  value: string | undefined,
  name: string,
  fallback: number,
  max: number,
): number => parseIntUpTo(value || String(fallback), name, max)

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
  const entries = parseHostList(value)

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
