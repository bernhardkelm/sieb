import type { ApiTokenScope } from '#core/apiToken.ts'
import type { BulkDecisionInput } from '#core/bulkDecisionValidation.ts'
import type { DecisionInput, DecisionPatch } from '#core/decision.ts'
import type { Exposure } from '#core/exposure.ts'
import type { DecisionView, FindingDetail } from '#core/findingView.ts'
import type { InboxCounts, InboxItem } from '#core/inbox/inboxItem.ts'
import type { PackageVersion } from '#core/instance.ts'
import type { KevDetails, KevFeedStatus, KevSourceKind } from '#core/kev.ts'
import type { OverviewStats, StatsPoint } from '#core/overviewStats.ts'
import type { AcceptedDecisionValues } from '#core/proposalAccept.ts'
import type { ExpectedDecisionId } from '#core/proposalFreshness.ts'
import type { ProposalState } from '#core/proposal.ts'
import type { ProposalView } from '#core/proposalView.ts'
import type { Severity } from '#core/severity.ts'
import type { SourceAccess } from '#core/sourceAccess.ts'
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

/** Answer of GET /api/inbox: what waits for the acting user, in Inbox order */
export interface InboxResponse {
  items: InboxItem[]
  counts: InboxCounts
}

/** Body of POST /api/inbox/seen, only expiring and kev keys */
export interface InboxSeenRequest {
  keys: string[]
}

/** Answer of POST /api/inbox/seen: the counts after the marks */
export interface InboxSeenResponse {
  counts: InboxCounts
  ignored: string[] // valid keys not listed in the user's Inbox, not marked
}

/** Answer of GET /api/findings/:id: the side panel detail with the source access of the image */
export interface FindingDetailResponse extends FindingDetail {
  sourceAccess: SourceAccess
}

/** Filter of GET /api/proposals?state=, all lists every state */
export type ProposalStateFilter = ProposalState | 'all'

/** One proposal as GET /api/proposals lists it */
export interface ProposalListItem {
  proposal: ProposalView
  outdated: boolean // open only: a governing decision of a target changed since it was filed
  severity: Severity // highest over the open target findings, all target findings once none is open
  kev: boolean // a target finding is KEV listed
  imageCount: number // target images, for scope all the images with an open finding
}

/** sieb's own facts on one image of a proposal, shown next to the claims */
export interface ProposalImageFacts {
  imageRef: string
  findingId: number | null // null when sieb has no finding of the vulnerability in the image
  open: boolean
  severity: Severity | null
  score: number | null
  kev: boolean
  exposure: Exposure | null
  owner: string | null
  sourceAccess: SourceAccess // now, the proposal keeps its own snapshot in proposal.sourceAccess
  versions: PackageVersion[] // package, installed and fixed version of the current instances
  workloads: string[] // namespace/kind/name
  decision: DecisionView | null // decision governing the image now
}

/** Answer of GET /api/proposals/:id */
export interface ProposalDetail extends ProposalListItem {
  images: ProposalImageFacts[] // scope image: the targets, scope all: every image with an open finding
  allScopeDecision: DecisionView | null // current all-scope decision of the vulnerability
  currentDecisionIds: ExpectedDecisionId[] // governing decision per target, send as expectedDecisionIds
  decisionValues: AcceptedDecisionValues // what accepting without edits writes, prefill of Edit & accept
  kevCatalog: KevDetails | null // CISA catalog entry, null for other KEV sources and unlisted CVEs
}

/** Body of POST /api/proposals/:id/accept, edits leave scope and images as proposed */
export interface ProposalAcceptRequest {
  expectedDecisionIds: ExpectedDecisionId[]
  edits?: Partial<AcceptedDecisionValues>
}

/** Answer of POST /api/proposals/:id/accept */
export interface ProposalAcceptResponse {
  proposal: ProposalView
  decisions: DecisionView[] // created or updated decisions
  supersededIds: number[] // other open proposals for an overlapping target
}

/** Body of POST /api/proposals/:id/reject */
export interface ProposalRejectRequest {
  reason: string // 1 to 2000 characters
}

/** Answer of POST /api/proposals/:id/reject */
export interface ProposalRejectResponse {
  proposal: ProposalView
}

/** 409 of an accept whose expected decisions are no longer current */
export interface ProposalConflictBody {
  error: 'proposal_conflict'
  currentDecisionIds: ExpectedDecisionId[]
}

/** 409 of an accept or reject of a proposal that is no longer open */
export interface ProposalClosedBody {
  error: 'proposal_closed'
  state: ProposalState
}
