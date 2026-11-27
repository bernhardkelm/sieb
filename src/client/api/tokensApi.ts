import type { McpInfoResponse } from '#core/mcpApiTypes.ts'
import type {
  ApiTokenCleanupResponse,
  ApiTokenCreateRequest,
  ApiTokenCreateResponse,
  ApiTokenView,
} from '#core/tokenApiTypes.ts'
import { apiRequest } from '@/api/apiRequest'

export const TOKENS_URL = '/api/tokens'

/**
 * Fetches the personal API tokens of the acting user, newest first.
 * @returns {Promise<ApiTokenView[]>} - Tokens, revoked ones included
 */
export const fetchTokens = (): Promise<ApiTokenView[]> => apiRequest(TOKENS_URL)

/**
 * Creates a personal API token.
 * @param {ApiTokenCreateRequest} input - Name, scope and expiry, null for never
 * @returns {Promise<ApiTokenCreateResponse>} - Stored token and its secret, shown only once
 * @throws {ApiError} - 400 with validation errors, 409 too_many_tokens, 404 mcp_disabled
 */
export const createToken = (input: ApiTokenCreateRequest): Promise<ApiTokenCreateResponse> =>
  apiRequest(TOKENS_URL, 'POST', input)

/**
 * Revokes a personal API token of the acting user.
 * @param {number} id - Token id
 * @returns {Promise<ApiTokenView>} - Revoked token
 * @throws {ApiError} - 404 for unknown tokens and those of others
 */
export const revokeToken = (id: number): Promise<ApiTokenView> =>
  apiRequest(`${TOKENS_URL}/${id}/revoke`, 'POST', {})

/**
 * Deletes a revoked or expired personal API token of the acting user.
 * @param {number} id - Token id
 * @returns {Promise<void>}
 * @throws {ApiError} - 409 token_live while it still authenticates, 404 for unknown tokens and those of others
 */
export const deleteToken = (id: number): Promise<void> =>
  apiRequest(`${TOKENS_URL}/${id}`, 'DELETE')

/**
 * Deletes every revoked or expired personal API token of the acting user.
 * @returns {Promise<ApiTokenCleanupResponse>} - Number of deleted tokens
 */
export const cleanupTokens = (): Promise<ApiTokenCleanupResponse> =>
  apiRequest(`${TOKENS_URL}/cleanup`, 'POST', {})

/**
 * Fetches whether the Claude integration is on and where Claude reaches the MCP endpoint.
 * @returns {Promise<McpInfoResponse>} - Switch, MCP URL and whether claude.ai can sign in through OAuth
 */
export const fetchMcpInfo = (): Promise<McpInfoResponse> => apiRequest('/api/mcp-info')
