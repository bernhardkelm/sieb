import type { HealthResponse } from '#core/types.ts'
import { apiRequest } from '@/api/apiRequest'

/**
 * Fetches the server health with the configured source.
 * @returns {Promise<HealthResponse>} - Health and source kind
 */
export const fetchHealth = (): Promise<HealthResponse> => apiRequest('/api/health')
