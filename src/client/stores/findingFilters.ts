import type { ExposureFilter } from '#core/exposure.ts'
import type { PendingFilter } from '#core/findingPending.ts'
import type { FindingListView, FindingQuery } from '#core/findingQuery.ts'
import type { Severity } from '#core/severity.ts'
import type { LabelColumn } from '@/composables/useLabelColumns'

export const NEW_WITHIN_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

/** Filters the finding lists share, set from the filter bar */
export interface FindingFilters {
  q: string
  severity: Severity[]
  exposure: ExposureFilter[]
  owner: string[]
  newThisWeek: boolean
  kev: boolean
  includeResolved: boolean
  pending: PendingFilter[]
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
  pending: [],
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
 * Returns the filters without those on hidden label columns, which stay set but narrow nothing
 * until their column shows again.
 * @param {FindingFilters} filters - Filter bar state
 * @param {readonly LabelColumn[]} hidden - Hidden label columns, kev without a KEV source
 * @returns {FindingFilters} - Filters that apply
 */
export const withoutHiddenColumns = (
  filters: FindingFilters,
  hidden: readonly LabelColumn[],
): FindingFilters => ({
  ...filters,
  exposure: hidden.includes('exposure') ? [] : filters.exposure,
  owner: hidden.includes('owner') ? [] : filters.owner,
  kev: filters.kev && !hidden.includes('kev'),
})

/**
 * Builds the core finding query of a list view from the filters.
 * @param {FindingFilters} filters - Filter bar state
 * @param {FindingListView} view - Inbox or all findings
 * @param {Date} now - Current time, anchors "new this week"
 * @param {readonly LabelColumn[]} hidden - Hidden label columns, their filters are ignored
 * @returns {FindingQuery} - Query for filterFindings
 */
export const toFindingQuery = (
  filters: FindingFilters,
  view: FindingListView,
  now: Date,
  hidden: readonly LabelColumn[] = [],
): FindingQuery => {
  const applied = withoutHiddenColumns(filters, hidden)

  return {
    view,
    includeResolved: applied.includeResolved,
    q: applied.q.trim() || null,
    severity: applied.severity,
    exposure: applied.exposure,
    owner: applied.owner,
    newSince: applied.newThisWeek ? newSince(now) : null,
    kev: applied.kev,
    pending: applied.pending,
  }
}

/**
 * Returns whether any filter narrows the list.
 * @param {FindingFilters} filters - Filter bar state
 * @param {readonly LabelColumn[]} hidden - Hidden label columns, their filters are ignored
 * @returns {boolean} - True when a filter is set
 */
export const hasActiveFilters = (
  filters: FindingFilters,
  hidden: readonly LabelColumn[] = [],
): boolean => {
  const applied = withoutHiddenColumns(filters, hidden)

  return (
    applied.q.trim() !== '' ||
    applied.severity.length > 0 ||
    applied.exposure.length > 0 ||
    applied.owner.length > 0 ||
    applied.newThisWeek ||
    applied.kev ||
    applied.includeResolved ||
    applied.pending.length > 0
  )
}
