import type { ImageAggregate } from '#core/imageAggregation.ts'
import { exposureRank } from '#core/exposure.ts'
import { ownerSortKey } from '#core/owner.ts'
import { SEVERITIES } from '#core/severity.ts'
import { sortItems, type SortColumns, type SortState } from '@/components/list/listSort'
import { imageSortName } from '@/format/imageName'

export type ImageSortColumn =
  | 'name'
  | 'owner'
  | 'exposure'
  | 'severity'
  | 'kev'
  | 'open'
  | 'inbox'
  | 'notAffected'
  | 'accepted'
  | 'workloads'

export const IMAGE_SORT_COLUMNS: SortColumns<ImageAggregate, ImageSortColumn> = {
  name: { label: 'Image', first: 'asc', value: (image) => imageSortName(image.imageRef) },
  owner: { label: 'Owner', first: 'asc', value: (image) => ownerSortKey(image.owner) },
  exposure: { label: 'Exposure', first: 'desc', value: (image) => exposureRank(image.maxExposure) },
  severity: {
    label: 'Open by severity',
    first: 'desc',
    value: (image) => SEVERITIES.map((severity) => image.openBySeverity[severity]),
  },
  kev: { label: 'KEV', first: 'desc', value: (image) => image.kevCount },
  open: { label: 'Open', first: 'desc', value: (image) => image.openCount },
  inbox: { label: 'Triage', first: 'desc', value: (image) => image.inboxCount },
  notAffected: {
    label: 'Not affected',
    first: 'desc',
    value: (image) => image.notAffectedCount,
  },
  accepted: { label: 'Accepted', first: 'desc', value: (image) => image.acceptedCount },
  workloads: { label: 'Workloads', first: 'desc', value: (image) => image.workloadCount },
}

/**
 * Sorts images by a column, ties in the order the API returns them.
 * @param {readonly ImageAggregate[]} images - Images in API order
 * @param {SortState<ImageSortColumn> | null} sort - Active sort, null keeps the API order
 * @returns {ImageAggregate[]} - Sorted copy
 */
export const sortImages = (
  images: readonly ImageAggregate[],
  sort: SortState<ImageSortColumn> | null,
): ImageAggregate[] => sortItems(images, IMAGE_SORT_COLUMNS, sort)
