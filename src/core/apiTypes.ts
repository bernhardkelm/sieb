import type { ApiTokenScope } from '#core/apiToken.ts'
import type { BulkDecisionInput } from '#core/bulkDecisionValidation.ts'
import type { DecisionInput, DecisionPatch } from '#core/decision.ts'
import type { DecisionView } from '#core/findingView.ts'
import type { KevFeedStatus, KevSourceKind } from '#core/kev.ts'
import type { OverviewStats, StatsPoint } from '#core/overviewStats.ts'
import type { SyncRun } from '#core/syncRun.ts'

/** One problem of a rejected request, field null for problems of the whole input */
export interface ValidationIssue {
  field: string | null
  code: string
}

/** Body of a 400 answer */
export interface ValidationErrorBody {
  error: 'validation'
  errors: ValidationIssue[]
}

/** Body of every other non-2xx answer */
export interface ErrorBody {
  error: string
  decisionId?: number // conflicting or revoked decision for 409 answers
}

/** How the UI user is authenticated: forward-auth header or sieb's own OIDC login */
export type AuthMode = 'header' | 'oidc'

export interface MeResponse {
  username: string | null // null when neither the auth header nor a dev user is present
  authMode: AuthMode
}

/** Answer of POST /auth/logout: where the browser goes to end the issuer session too */
export interface LogoutResponse {
  redirect: string // absolute URL, the issuer end-session endpoint or the public URL
}

export interface SyncStatusResponse {
  run: SyncRun | null // latest run, possibly still running
  lastFinished: SyncRun | null
  running: boolean
  kevFeed: KevFeedStatus | null // CISA catalog health, null unless SIEB_KEV_SOURCE is cisa
}

/** Optional finding labels present on open findings and the KEV source, absent ones are hidden in the UI */
export interface LabelsResponse {
  exposure: boolean // some open finding has an exposure label
  owners: string[] // distinct owner labels of open findings, self first, then alphabetical
  kev: KevSourceKind // none hides every KEV element
}

export interface StatsResponse {
  current: OverviewStats // computed live
  series: StatsPoint[] // snapshots of successful syncs, at most one per bucket, oldest first
}

/** Why a bulk skipped an image: its existing decision is active or fix_planned, expired, re-opened, or no finding exists */
export type BulkSkipReason = 'decided' | 'expired' | 'reopened' | 'unknown_finding'

export interface BulkDecisionSkip {
  imageRef: string
  reason: BulkSkipReason
  decisionId: number | null // existing non-revoked decision, null for unknown_finding
}

export interface BulkDecisionResult {
  created: DecisionView[]
  skipped: BulkDecisionSkip[]
}

/** Body of POST /api/decisions, an omitted expiresAt takes the default of the status */
export type DecisionRequest = Omit<DecisionInput, 'expiresAt' | 'imageRef' | 'justification'> & {
  imageRef?: string | null
  expiresAt?: string | null
  justification?: DecisionInput['justification']
}

/** Body of PATCH /api/decisions/:id, reconfirm true clears a re-open and records new baselines */
export type DecisionPatchRequest = Omit<DecisionPatch, 'reconfirm'> & { reconfirm?: boolean }

/** Body of POST /api/decisions/bulk */
export type BulkDecisionRequest = Omit<BulkDecisionInput, 'expiresAt' | 'justification'> & {
  expiresAt?: string | null
  justification?: BulkDecisionInput['justification']
}

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

/** Answer of GET /api/mcp-info, also while MCP is disabled so the UI can hide it */
export interface McpInfoResponse {
  enabled: boolean // SIEB_MCP_ENABLED
  mcpUrl: string | null // absolute URL of the MCP endpoint, null while disabled
  oauth: boolean // whether claude.ai connectors can sign in through OAuth, false while disabled
}
