import type { ImageAggregate } from '#core/imageAggregation.ts'
import {
  containsSearch,
  passesSelection,
  type AggregateFilters,
} from '@/components/filters/aggregateFilters'

/**
 * Filters images by search text over image_ref and workloads, owner, highest exposure and
 * highest open severity, keeping their order.
 * @param {readonly ImageAggregate[]} images - Images, own ones first
 * @param {AggregateFilters} filters - Filter state
 * @returns {ImageAggregate[]} - Matching images
 */
export const filterImages = (
  images: readonly ImageAggregate[],
  filters: AggregateFilters,
): ImageAggregate[] =>
  images.filter(
    (image) =>
      passesSelection(filters.owner, image.owner) &&
      passesSelection(filters.exposure, image.maxExposure) &&
      passesSelection(filters.severity, image.maxSeverity) &&
      containsSearch([image.imageRef, ...image.workloads], filters.q),
  )
