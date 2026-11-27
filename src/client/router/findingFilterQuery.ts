import type { LocationQuery } from 'vue-router'

import { isExposureFilter, type ExposureFilter } from '#core/exposure.ts'
import { isPendingFilter, type PendingFilter } from '#core/findingPending.ts'
import { isOwner } from '#core/owner.ts'
import { SEVERITIES, type Severity } from '#core/severity.ts'
import { readQueryParam } from '@/router/queryParam'
import { emptyFilters, type FindingFilters } from '@/stores/findingFilters'

/** Query params of the finding filters, compact so links stay short */
export const FILTER_QUERY = {
  q: 'q',
  severity: 'sev',
  exposure: 'exp',
  owner: 'owner',
  kev: 'kev',
  newThisWeek: 'new',
  includeResolved: 'resolved',
  pending: 'pending',
} as const satisfies Record<keyof FindingFilters, string>

const FLAG_ON = '1'

/**
 * Splits a comma separated param into the entries a guard accepts, dropping the others.
 * @param {string | null} raw - Param value
 * @param {(entry: string) => T | null} read - Returns the entry as a value, null to drop it
 * @returns {T[]} - Distinct valid entries in order
 */
const readEntries = <T>(raw: string | null, read: (entry: string) => T | null): T[] => {
  const values = (raw ?? '')
    .split(',')
    .map((entry) => read(entry.trim()))
    .filter((value): value is T => value !== null)

  return [...new Set(values)]
}

/**
 * Reads a severity case-insensitively, as `sev=critical,high` writes it.
 * @param {string} entry - Param entry
 * @returns {Severity | null} - Severity, null for unknown entries
 */
const readSeverity = (entry: string): Severity | null =>
  SEVERITIES.find((severity) => severity.toLowerCase() === entry.toLowerCase()) ?? null

/**
 * Reads an exposure filter entry case-insensitively.
 * @param {string} entry - Param entry
 * @returns {ExposureFilter | null} - Exposure or unknown, null for other entries
 */
const readExposure = (entry: string): ExposureFilter | null => {
  const value = entry.toLowerCase()

  return isExposureFilter(value) ? value : null
}

/**
 * Reads a pending filter entry case-insensitively.
 * @param {string} entry - Param entry
 * @returns {PendingFilter | null} - Option, null for other entries
 */
const readPending = (entry: string): PendingFilter | null => {
  const value = entry.toLowerCase()

  return isPendingFilter(value) ? value : null
}

/**
 * Joins list values into a comma separated param.
 * @param {readonly string[]} values - Values
 * @returns {string | null} - Param value, null for an empty list
 */
const listParam = (values: readonly string[]): string | null =>
  values.length > 0 ? values.join(',') : null

/**
 * Writes a boolean filter as a flag param.
 * @param {boolean} value - Filter value
 * @returns {string | null} - 1 when set, null otherwise
 */
const flagParam = (value: boolean): string | null => (value ? FLAG_ON : null)

/**
 * Reads the finding filters from the route query; unknown or invalid values are ignored, so a
 * hand-edited link falls back to the unfiltered list for that filter.
 * @param {LocationQuery} query - Route query
 * @returns {FindingFilters} - Filters, empty ones for absent params
 */
export const readFindingFilters = (query: LocationQuery): FindingFilters => {
  /**
   * Reads the param of one filter.
   * @param {keyof FindingFilters} key - Filter name
   * @returns {string | null} - Param value, null when absent
   */
  const param = (key: keyof FindingFilters): string | null =>
    readQueryParam(query, FILTER_QUERY[key])

  return {
    q: param('q') ?? '',
    severity: readEntries(param('severity'), readSeverity),
    exposure: readEntries(param('exposure'), readExposure),
    owner: readEntries(param('owner'), (entry) => (isOwner(entry) ? entry : null)),
    kev: param('kev') === FLAG_ON,
    newThisWeek: param('newThisWeek') === FLAG_ON,
    includeResolved: param('includeResolved') === FLAG_ON,
    pending: readEntries(param('pending'), readPending),
  }
}

/**
 * Returns the query params of the finding filters, null for each filter that is not set, so
 * withQueryParams removes it.
 * @param {FindingFilters} filters - Filters
 * @returns {Record<string, string | null>} - Value per param
 */
export const findingFilterParams = (filters: FindingFilters): Record<string, string | null> => ({
  [FILTER_QUERY.q]: filters.q === '' ? null : filters.q,
  [FILTER_QUERY.severity]: listParam(filters.severity.map((severity) => severity.toLowerCase())),
  [FILTER_QUERY.exposure]: listParam(filters.exposure),
  [FILTER_QUERY.owner]: listParam(filters.owner),
  [FILTER_QUERY.kev]: flagParam(filters.kev),
  [FILTER_QUERY.newThisWeek]: flagParam(filters.newThisWeek),
  [FILTER_QUERY.includeResolved]: flagParam(filters.includeResolved),
  [FILTER_QUERY.pending]: listParam(filters.pending),
})

/**
 * Returns the query of a link that opens a list with some finding filters set and the others
 * cleared, such as the stat panels.
 * @param {Partial<FindingFilters>} patch - Filters to set
 * @returns {Record<string, string>} - Params of the set filters only
 */
export const findingFilterQuery = (patch: Partial<FindingFilters>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(findingFilterParams({ ...emptyFilters(), ...patch })).filter(
      (entry): entry is [string, string] => entry[1] !== null,
    ),
  )

/**
 * Returns whether two filter states are equal.
 * @param {FindingFilters} a - First filters
 * @param {FindingFilters} b - Second filters
 * @returns {boolean} - True when every filter matches
 */
export const sameFindingFilters = (a: FindingFilters, b: FindingFilters): boolean =>
  JSON.stringify(findingFilterParams(a)) === JSON.stringify(findingFilterParams(b))
