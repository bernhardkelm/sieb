import type { CheckCreateRequest, CheckCreateResponse, ChecksResponse } from '#core/check.ts'
import { apiRequest } from '@/api/apiRequest'

export const CHECKS_URL = '/api/checks'

/**
 * Fetches the Auto-checks: whether the feature is on, the worker state, the running check, the
 * queue and the recent ones.
 * @returns {Promise<ChecksResponse>} - Checks
 */
export const fetchChecks = (): Promise<ChecksResponse> => apiRequest(CHECKS_URL)

/**
 * Queues an Auto-check per finding, the server skips the ones it cannot check.
 * @param {number[]} findingIds - Finding ids, 1 to 100
 * @returns {Promise<CheckCreateResponse>} - Queued checks and the skipped findings with their reason
 */
export const createChecks = (findingIds: number[]): Promise<CheckCreateResponse> =>
  apiRequest(CHECKS_URL, 'POST', { findingIds } satisfies CheckCreateRequest)

/**
 * Cancels a queued or running check.
 * @param {number} id - Check id
 * @returns {Promise<void>} - Resolves once cancelled
 */
export const cancelCheck = async (id: number): Promise<void> => {
  await apiRequest<unknown>(`${CHECKS_URL}/${id}`, 'DELETE')
}
