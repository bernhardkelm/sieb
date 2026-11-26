import { isOnlyNotAffected, withNotAffected, type ImageAggregate } from '#core/imageAggregation.ts'
import {
  containsSearch,
  passesSelection,
  type AggregateFilters,
} from '@/components/filters/aggregateFilters'

/**
 * Filters images by search text over image_ref and workloads, owner, highest exposure and
 * highest open severity, keeping their order. Without showNotAffected the counts leave out not
 * affected findings and images with nothing else open drop out; with it they count every open
 * finding.
 * @param {readonly ImageAggregate[]} images - Images, own ones first
 * @param {AggregateFilters} filters - Filter state
 * @returns {ImageAggregate[]} - Matching images
 */
export const filterImages = (
  images: readonly ImageAggregate[],
  filters: AggregateFilters,
): ImageAggregate[] =>
  (filters.showNotAffected
    ? images.map(withNotAffected)
    : images.filter((image) => !isOnlyNotAffected(image))
  ).filter(
    (image) =>
      passesSelection(filters.owner, image.owner) &&
      passesSelection(filters.exposure, image.maxExposure) &&
      passesSelection(filters.severity, image.maxSeverity) &&
      containsSearch([image.imageRef, ...image.workloads], filters.q),
  )

/**
 * Counts the images the not affected toggle hides: those passing the other filters whose open
 * findings are all not affected.
 * @param {readonly ImageAggregate[]} images - Images
 * @param {AggregateFilters} filters - Filter state
 * @returns {number} - Hidden images, 0 while the toggle is on
 */
export const countHiddenImages = (
  images: readonly ImageAggregate[],
  filters: AggregateFilters,
): number =>
  filters.showNotAffected
    ? 0
    : filterImages(images.filter(isOnlyNotAffected), { ...filters, showNotAffected: true }).length
