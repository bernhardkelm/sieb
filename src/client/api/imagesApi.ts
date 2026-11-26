import type { ImageAggregate } from '#core/imageAggregation.ts'
import { apiRequest } from '@/api/apiRequest'
import { queryString } from '@/api/queryString'

/**
 * Fetches the findings aggregated per image.
 * @param {{ includeResolved?: boolean }} options - Also images whose findings are all resolved
 * @returns {Promise<ImageAggregate[]>} - Images, own ones first
 */
export const fetchImages = (
  options: { includeResolved?: boolean } = {},
): Promise<ImageAggregate[]> => apiRequest(`/api/images${queryString(options)}`)
