import type { FindingListView, FindingQuery } from '#core/findingQuery.ts'
import type { Exposure } from '#core/exposure.ts'
import type { Severity } from '#core/severity.ts'

export const NEW_WITHIN_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

/** Filters the finding lists share, set from the filter bar */
export interface FindingFilters {
  q: string
  severity: Severity[]
  exposure: Exposure[]
  owner: string[]
  newThisWeek: boolean
  kev: boolean
  includeResolved: boolean
}

/**
 * Returns filters that match everything.
 * @returns {FindingFilters} - Empty filters
 */
export const emptyFilters = (): FindingFilters => ({
  q: '',
  severity: [],
  exposure: [],
  owner: [],
  newThisWeek: false,
  kev: false,
  includeResolved: false,
})

/**
 * Returns the start of the "new" window.
 * @param {Date} now - Current time
 * @returns {string} - ISO timestamp seven days before now
 */
export const newSince = (now: Date): string =>
  new Date(now.getTime() - NEW_WITHIN_DAYS * DAY_MS).toISOString()

/**
 * Returns whether a finding counts as new.
 * @param {string} firstSeen - ISO timestamp of the first sighting
 * @param {Date} now - Current time
 * @returns {boolean} - True when first seen within the last seven days
 */
export const isNewFinding = (firstSeen: string, now: Date): boolean =>
  Date.parse(firstSeen) >= Date.parse(newSince(now))

/**
 * Builds the core finding query of a list view from the filters.
 * @param {FindingFilters} filters - Filter bar state
 * @param {FindingListView} view - Inbox or all findings
 * @param {Date} now - Current time, anchors "new this week"
 * @param {boolean} kevAvailable - Whether a KEV source is configured, the KEV filter is ignored without
 * @returns {FindingQuery} - Query for filterFindings
 */
export const toFindingQuery = (
  filters: FindingFilters,
  view: FindingListView,
  now: Date,
  kevAvailable = true,
): FindingQuery => ({
  view,
  includeResolved: filters.includeResolved,
  q: filters.q.trim() || null,
  severity: filters.severity,
  exposure: filters.exposure,
  owner: filters.owner,
  newSince: filters.newThisWeek ? newSince(now) : null,
  kev: filters.kev && kevAvailable,
})

/**
 * Returns whether any filter narrows the list.
 * @param {FindingFilters} filters - Filter bar state
 * @param {boolean} kevAvailable - Whether a KEV source is configured, the KEV filter is ignored without
 * @returns {boolean} - True when a filter is set
 */
export const hasActiveFilters = (filters: FindingFilters, kevAvailable = true): boolean =>
  filters.q.trim() !== '' ||
  filters.severity.length > 0 ||
  filters.exposure.length > 0 ||
  filters.owner.length > 0 ||
  filters.newThisWeek ||
  (filters.kev && kevAvailable) ||
  filters.includeResolved
