import type { ApiTokenScope } from '#core/apiToken.ts'

/** Personal API token as listed in the UI, never with its secret or hash */
export interface ApiTokenView {
  id: number
  name: string
  scope: ApiTokenScope
  prefix: string // first characters of the secret, to recognise the token
  createdAt: string
  expiresAt: string | null // null never expires
  lastUsedAt: string | null
  revokedAt: string | null
}

/** Body of POST /api/tokens */
export interface ApiTokenCreateRequest {
  name: string
  scope: ApiTokenScope
  expiresAt: string // ISO date-time or date, at most 365 days ahead
}

/** Answer of POST /api/tokens, the only time the secret leaves the server */
export interface ApiTokenCreateResponse {
  token: ApiTokenView
  secret: string
}

/** Answer of POST /api/tokens/cleanup */
export interface ApiTokenCleanupResponse {
  deleted: number // revoked and expired tokens removed
}
