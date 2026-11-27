import { matchesExposureFilter, type ExposureFilter } from '#core/exposure.ts'
import type { InboxItem, InboxKind } from '#core/inbox/inboxItem.ts'
import type { Severity } from '#core/severity.ts'
import { containsSearch, passesSelection } from '@/components/filters/aggregateFilters'
import type { LabelColumn } from '@/composables/useLabelColumns'

/** Filters of the Inbox, set from its filter bar */
export interface InboxFilters {
  q: string
  kind: InboxKind[]
  severity: Severity[]
  exposure: ExposureFilter[]
  owner: string[]
  kev: boolean
}

/**
 * Returns Inbox filters that match everything.
 * @returns {InboxFilters} - Empty filters
 */
export const emptyInboxFilters = (): InboxFilters => ({
  q: '',
  kind: [],
  severity: [],
  exposure: [],
  owner: [],
  kev: false,
})

/**
 * Returns the Inbox filters without those on hidden label columns, which stay set but narrow
 * nothing until their column shows again.
 * @param {InboxFilters} filters - Filter state
 * @param {readonly LabelColumn[]} hidden - Hidden label columns, kev without a KEV source
 * @returns {InboxFilters} - Filters that apply
 */
export const withoutHiddenInboxColumns = (
  filters: InboxFilters,
  hidden: readonly LabelColumn[],
): InboxFilters => ({
  ...filters,
  exposure: hidden.includes('exposure') ? [] : filters.exposure,
  owner: hidden.includes('owner') ? [] : filters.owner,
  kev: filters.kev && !hidden.includes('kev'),
})

/**
 * Returns whether any Inbox filter narrows the list.
 * @param {InboxFilters} filters - Filter state
 * @param {readonly LabelColumn[]} hidden - Hidden label columns, their filters are ignored
 * @returns {boolean} - True when a filter is set
 */
export const hasInboxFilters = (
  filters: InboxFilters,
  hidden: readonly LabelColumn[] = [],
): boolean => {
  const applied = withoutHiddenInboxColumns(filters, hidden)

  return (
    applied.q.trim() !== '' ||
    applied.kind.length > 0 ||
    applied.severity.length > 0 ||
    applied.exposure.length > 0 ||
    applied.owner.length > 0 ||
    applied.kev
  )
}

/**
 * Returns the texts the Inbox search looks at: vuln_id, title, target images, packages and
 * namespaces of the covered open findings.
 * @param {InboxItem} item - Item
 * @returns {string[]} - Searchable texts
 */
const searchTexts = (item: InboxItem): string[] => [
  item.vulnId,
  item.title ?? '',
  ...(item.imageRef === null ? [] : [item.imageRef]),
  ...(item.kind === 'proposal' ? (item.imageRefs ?? []) : []),
  ...item.packages,
  ...item.namespaces,
]

/**
 * Returns whether an item passes the Inbox filters. Severity and exposure read the most
 * pressing covered finding, owner passes when any covered finding has a selected owner.
 * @param {InboxItem} item - Item
 * @param {InboxFilters} filters - Filters that apply
 * @returns {boolean} - True when the item is listed
 */
const matchesInboxFilters = (item: InboxItem, filters: InboxFilters): boolean =>
  passesSelection(filters.kind, item.kind) &&
  passesSelection(filters.severity, item.severity) &&
  matchesExposureFilter(filters.exposure, item.exposure) &&
  (filters.owner.length === 0 || item.owners.some((owner) => filters.owner.includes(owner))) &&
  (!filters.kev || item.kev) &&
  containsSearch(searchTexts(item), filters.q)

/**
 * Filters Inbox items, keeping their order.
 * @param {readonly InboxItem[]} items - Items in Inbox order
 * @param {InboxFilters} filters - Filters that apply, without those on hidden columns
 * @returns {InboxItem[]} - Matching items
 */
export const filterInboxItems = (items: readonly InboxItem[], filters: InboxFilters): InboxItem[] =>
  items.filter((item) => matchesInboxFilters(item, filters))
