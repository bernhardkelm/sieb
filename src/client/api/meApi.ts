import type { MeResponse } from '#core/apiTypes.ts'
import { apiRequest } from '@/api/apiRequest'
import type { AuthMode } from '@/api/session'

export type Me = Omit<MeResponse, 'authMode'> & { authMode?: AuthMode }

/**
 * Fetches the acting user and the auth mode.
 * @returns {Promise<Me>} - Username, null when anonymous, and the auth mode
 */
export const fetchMe = (): Promise<Me> => apiRequest<Me>('/api/me')
