import type { FindingDetailResponse } from '#core/apiTypes.ts'
import type { FindingQuery } from '#core/findingQuery.ts'
import type { FindingView } from '#core/findingView.ts'
import { apiRequest } from '@/api/apiRequest'
import { queryString } from '@/api/queryString'

export const FINDINGS_URL = '/api/findings'

/**
 * Fetches findings in inbox order, filtered on the server.
 * @param {Partial<FindingQuery>} query - Filters, view all without resolved findings by default
 * @returns {Promise<FindingView[]>} - Findings
 */
export const fetchFindings = (query: Partial<FindingQuery> = {}): Promise<FindingView[]> =>
  apiRequest(`${FINDINGS_URL}${queryString({ ...query })}`)

/**
 * Fetches the detail of one finding for the side panel.
 * @param {number} id - Finding id
 * @returns {Promise<FindingDetailResponse>} - Detail with instances, decisions, history and source access
 * @throws {ApiError} - With status 404 for an unknown finding
 */
export const fetchFindingDetail = (id: number): Promise<FindingDetailResponse> =>
  apiRequest(`${FINDINGS_URL}/${id}`)
