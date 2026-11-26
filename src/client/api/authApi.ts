import { apiRequest } from '@/api/apiRequest'

/**
 * Ends the session on the server.
 * @returns {Promise<string>} - Address to navigate to, the identity provider logout or the start page
 */
export const logout = async (): Promise<string> =>
  (await apiRequest<{ redirect: string }>('/auth/logout', 'POST', {})).redirect
