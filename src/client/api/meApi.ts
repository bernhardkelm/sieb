import type { BuildInfo, MeResponse } from '#core/apiTypes.ts'
import { apiRequest } from '@/api/apiRequest'
import type { AuthMode } from '@/api/session'

export type Me = Omit<MeResponse, 'authMode' | keyof BuildInfo> &
  Partial<BuildInfo> & { authMode?: AuthMode }

/**
 * Fetches the acting user, the auth mode and the running build.
 * @returns {Promise<Me>} - Username, null when anonymous, the auth mode, version and source code link
 */
export const fetchMe = (): Promise<Me> => apiRequest<Me>('/api/me')
