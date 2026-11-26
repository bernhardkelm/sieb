import type { ExposureFilter } from '#core/exposure.ts'
import type { Severity } from '#core/severity.ts'
import type { LabelColumn } from '@/composables/useLabelColumns'

/** Filters of the aggregate views, by image and by CVE */
export interface AggregateFilters {
  q: string
  severity: Severity[]
  exposure: ExposureFilter[]
  owner: string[]
  showNotAffected: boolean // by image: counts and lists not affected findings, off by default
  showDecided: boolean // by CVE: lists CVEs whose open findings are all decided, off by default
}

export type AggregateToggle = 'showNotAffected' | 'showDecided'

/**
 * Returns aggregate filters that match everything.
 * @returns {AggregateFilters} - Empty filters
 */
export const emptyAggregateFilters = (): AggregateFilters => ({
  q: '',
  severity: [],
  exposure: [],
  owner: [],
  showNotAffected: false,
  showDecided: false,
})

/**
 * Returns the aggregate filters without those on hidden label columns, which stay set but narrow
 * nothing until their column shows again.
 * @param {AggregateFilters} filters - Filter state
 * @param {readonly LabelColumn[]} hidden - Hidden label columns
 * @returns {AggregateFilters} - Filters that apply
 */
export const withoutHiddenAggregateColumns = (
  filters: AggregateFilters,
  hidden: readonly LabelColumn[],
): AggregateFilters => ({
  ...filters,
  exposure: hidden.includes('exposure') ? [] : filters.exposure,
  owner: hidden.includes('owner') ? [] : filters.owner,
})

/**
 * Returns whether any aggregate filter narrows the list.
 * @param {AggregateFilters} filters - Filter state
 * @param {readonly LabelColumn[]} hidden - Hidden label columns, their filters are ignored
 * @returns {boolean} - True when a filter is set
 */
export const hasAggregateFilters = (
  filters: AggregateFilters,
  hidden: readonly LabelColumn[] = [],
): boolean => {
  const applied = withoutHiddenAggregateColumns(filters, hidden)

  return (
    applied.q.trim() !== '' ||
    applied.severity.length > 0 ||
    applied.exposure.length > 0 ||
    applied.owner.length > 0 ||
    applied.showNotAffected ||
    applied.showDecided
  )
}

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
