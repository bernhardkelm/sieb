import type { CveAggregate } from '#core/cveAggregation.ts'
import { exposureRank } from '#core/exposure.ts'
import { severityRank } from '#core/severity.ts'
import { sortItems, type SortColumns, type SortState } from '@/components/list/listSort'

export type CveSortColumn =
  | 'severity'
  | 'kev'
  | 'vulnId'
  | 'title'
  | 'images'
  | 'exposure'
  | 'open'
  | 'inbox'

export const CVE_SORT_COLUMNS: SortColumns<CveAggregate, CveSortColumn> = {
  severity: {
    label: 'Severity',
    first: 'desc',
    value: (cve) => [severityRank(cve.maxSeverity), cve.maxScore ?? -1],
  },
  kev: { label: 'KEV', first: 'desc', value: (cve) => Number(cve.kev) },
  vulnId: { label: 'CVE', first: 'asc', value: (cve) => cve.vulnId },
  title: { label: 'Title', first: 'asc', value: (cve) => cve.title || null },
  images: { label: 'Images', first: 'desc', value: (cve) => cve.imageCount },
  exposure: { label: 'Exposure', first: 'desc', value: (cve) => exposureRank(cve.maxExposure) },
  open: { label: 'Open', first: 'desc', value: (cve) => cve.openCount },
  inbox: { label: 'Inbox', first: 'desc', value: (cve) => cve.inboxCount },
}

/**
 * Sorts CVEs by a column, ties in the order the API returns them.
 * @param {readonly CveAggregate[]} cves - CVEs in API order
 * @param {SortState<CveSortColumn> | null} sort - Active sort, null keeps the API order
 * @returns {CveAggregate[]} - Sorted copy
 */
export const sortCves = (
  cves: readonly CveAggregate[],
  sort: SortState<CveSortColumn> | null,
): CveAggregate[] => sortItems(cves, CVE_SORT_COLUMNS, sort)
