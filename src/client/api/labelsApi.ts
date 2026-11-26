import type { LabelsResponse } from '#core/apiTypes.ts'
import { apiRequest } from '@/api/apiRequest'

/**
 * Fetches which optional labels the open findings carry.
 * @returns {Promise<LabelsResponse>} - Exposure presence and distinct owners
 */
export const fetchLabels = (): Promise<LabelsResponse> => apiRequest('/api/labels')
