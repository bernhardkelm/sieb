import type { CveAggregate } from '#core/cveAggregation.ts'
import { apiRequest } from '@/api/apiRequest'
import { queryString } from '@/api/queryString'

/**
 * Fetches the findings aggregated per CVE across images.
 * @param {{ includeResolved?: boolean }} options - Also CVEs whose findings are all resolved
 * @returns {Promise<CveAggregate[]>} - CVEs in inbox order
 */
export const fetchCves = (options: { includeResolved?: boolean } = {}): Promise<CveAggregate[]> =>
  apiRequest(`/api/cves${queryString(options)}`)
