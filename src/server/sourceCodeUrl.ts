import { parseHttpUrl } from '#server/configValues.ts'

export const UPSTREAM_REPOSITORY_URL = 'https://github.com/bernhardkelm/sieb'

/**
 * Validates the source code link of a fork.
 * @param {string | undefined} value - Raw SIEB_SOURCE_URL value
 * @returns {string | null} - URL, null when unset or blank
 * @throws {Error} - When the value is not an http or https URL
 */
export const parseSourceCodeUrl = (value: string | undefined): string | null =>
  value?.trim() ? parseHttpUrl(value, 'SIEB_SOURCE_URL', '') : null

/**
 * Returns where the source code of the running version is published: the override of a fork,
 * otherwise the upstream tree of the release tag, which carries no v prefix.
 * @param {string} version - Running sieb version
 * @param {string | null} override - SIEB_SOURCE_URL, null for none
 * @returns {string} - URL
 */
export const sourceCodeUrlOf = (version: string, override: string | null): string =>
  override ?? `${UPSTREAM_REPOSITORY_URL}/tree/${encodeURIComponent(version)}`
