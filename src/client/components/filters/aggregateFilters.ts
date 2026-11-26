import type { Exposure } from '#core/exposure.ts'
import type { Severity } from '#core/severity.ts'

/** Filters of the aggregate views, by image and by CVE */
export interface AggregateFilters {
  q: string
  severity: Severity[]
  exposure: Exposure[]
  owner: string[]
}

/**
 * Returns aggregate filters that match everything.
 * @returns {AggregateFilters} - Empty filters
 */
export const emptyAggregateFilters = (): AggregateFilters => ({
  q: '',
  severity: [],
  exposure: [],
  owner: [],
})

/**
 * Returns whether any aggregate filter narrows the list.
 * @param {AggregateFilters} filters - Filter state
 * @returns {boolean} - True when a filter is set
 */
export const hasAggregateFilters = (filters: AggregateFilters): boolean =>
  filters.q.trim() !== '' ||
  filters.severity.length > 0 ||
  filters.exposure.length > 0 ||
  filters.owner.length > 0

/**
 * Returns whether one of several texts contains the search text, case-insensitive.
 * @param {readonly string[]} haystack - Texts to search
 * @param {string} q - Search text, blank matches everything
 * @returns {boolean} - True on a match
 */
export const containsSearch = (haystack: readonly string[], q: string): boolean => {
  const needle = q.trim().toLowerCase()

  return needle === '' || haystack.some((value) => value.toLowerCase().includes(needle))
}

/**
 * Returns whether a value passes a multi-select filter.
 * @param {readonly T[]} selected - Selected values, empty matches everything
 * @param {T} value - Value of the row
 * @returns {boolean} - True when the value is selected or nothing is
 */
export const passesSelection = <T>(selected: readonly T[], value: T): boolean =>
  selected.length === 0 || selected.includes(value)
