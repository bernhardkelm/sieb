import type { LocationQuery, LocationQueryRaw } from 'vue-router'

/**
 * Reads a single string query param.
 * @param {LocationQuery} query - Current route query
 * @param {string} key - Param name
 * @returns {string | null} - Value, null when absent, empty or repeated
 */
export const readQueryParam = (query: LocationQuery, key: string): string | null => {
  const value = query[key]

  return typeof value === 'string' && value !== '' ? value : null
}

/**
 * Returns a copy of a query with several params set or removed, keeping every other param.
 * @param {LocationQuery} query - Current route query
 * @param {Record<string, string | null>} patch - New values per param, null removes the param
 * @returns {LocationQueryRaw} - Next query
 */
export const withQueryParams = (
  query: LocationQuery,
  patch: Record<string, string | null>,
): LocationQueryRaw => {
  const next: LocationQueryRaw = { ...query }

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete next[key]
    } else {
      next[key] = value
    }
  }

  return next
}

/**
 * Returns a copy of a query with one param set or removed, keeping every other param.
 * @param {LocationQuery} query - Current route query
 * @param {string} key - Param name
 * @param {string | null} value - New value, null removes the param
 * @returns {LocationQueryRaw} - Next query
 */
export const withQueryParam = (
  query: LocationQuery,
  key: string,
  value: string | null,
): LocationQueryRaw => withQueryParams(query, { [key]: value })
