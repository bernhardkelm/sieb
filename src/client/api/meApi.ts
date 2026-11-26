import type { MeResponse } from '#core/apiTypes.ts'
import { apiRequest } from '@/api/apiRequest'

/**
 * Fetches the acting user.
 * @returns {Promise<string | null>} - Username, null when anonymous
 */
export const fetchMe = async (): Promise<string | null> =>
  (await apiRequest<MeResponse>('/api/me')).username
