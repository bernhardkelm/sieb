import type { FindingView } from '#core/findingView.ts'
import { compareInbox } from '#core/inbox.ts'
import { exposureRank } from '#core/exposure.ts'
import { ownerSortKey } from '#core/owner.ts'
import { severityRank } from '#core/severity.ts'
import { sortItems, type SortColumns, type SortState } from '@/components/list/listSort'
import { imageSortName } from '@/format/imageName'

export type InboxSortColumn =
  | 'severity'
  | 'kev'
  | 'vulnId'
  | 'title'
  | 'image'
  | 'exposure'
  | 'owner'
  | 'workloads'
  | 'firstSeen'

export const INBOX_SORT_COLUMNS: SortColumns<FindingView, InboxSortColumn> = {
  severity: {
    label: 'Severity',
    first: 'desc',
    value: (finding) => [severityRank(finding.severity), finding.score ?? -1],
  },
  kev: { label: 'KEV', first: 'desc', value: (finding) => Number(finding.kev) },
  vulnId: { label: 'CVE', first: 'asc', value: (finding) => finding.vulnId },
  title: { label: 'Title', first: 'asc', value: (finding) => finding.title || null },
  image: { label: 'Image', first: 'asc', value: (finding) => imageSortName(finding.imageRef) },
  exposure: {
    label: 'Exposure',
    first: 'desc',
    value: (finding) => exposureRank(finding.exposure),
  },
  owner: { label: 'Owner', first: 'asc', value: (finding) => ownerSortKey(finding.owner) },
  workloads: { label: 'Workloads', first: 'desc', value: (finding) => finding.workloadCount },
  firstSeen: {
    label: 'First seen',
    first: 'desc',
    value: (finding) => Date.parse(finding.firstSeen),
  },
}

/**
 * Sorts inbox findings by a column, ties in triage order: KEV, exposure, severity, score.
 * Exposure ranks unknown between gated and internal, owner sorts self first and none last.
 * @param {readonly T[]} findings - Findings in triage order
 * @param {SortState<InboxSortColumn> | null} sort - Active sort, null keeps the triage order
 * @returns {T[]} - Sorted copy
 */
export const sortInbox = <T extends FindingView>(
  findings: readonly T[],
  sort: SortState<InboxSortColumn> | null,
): T[] => sortItems<T, InboxSortColumn>(findings, INBOX_SORT_COLUMNS, sort, compareInbox)
