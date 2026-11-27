import type { CheckedSource } from '#core/privateAccess.ts'

/** Life cycle of an Auto-check, queued and running are open */
export const CHECK_STATES = ['queued', 'running', 'done', 'failed', 'cancelled'] as const

export type CheckState = (typeof CHECK_STATES)[number]

/** What the worker is doing during a running check */
export const CHECK_PHASES = ['preparing', 'investigating', 'reporting'] as const

export type CheckPhase = (typeof CHECK_PHASES)[number]

/** Why a finding was not queued, in the order they are checked */
export const CHECK_SKIP_REASONS = [
  'not_found',
  'resolved',
  'not_public',
  'visibility_unknown', // an own image the pull probe has not answered for, no credential covers it
  'already_open',
  'covered_by_proposal', // listed in relatedFindings of an open proposal, force queues it anyway
  'queue_full',
] as const

export type CheckSkipReason = (typeof CHECK_SKIP_REASONS)[number]

/** Claude usage of one check, from `claude -p --output-format json` */
export interface CheckUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  costUsd: number | null // API-equivalent estimate, billed with an API key, plan limits with a subscription
  turns: number
  models?: string[] // model ids that ran, most output tokens first, absent from older results
}

/** One Auto-check as the client sees it */
export interface CheckView {
  id: number
  findingId: number
  vulnId: string
  imageRef: string
  requestedBy: string
  state: CheckState
  phase: CheckPhase | null // running checks only
  position: number | null // 1-based queue position, queued checks only
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  error: string | null // failed checks: short reason for humans
  proposalId: number | null // proposal filed with the check's token, if any
  usage: CheckUsage | null
  reply: string | null // Claude's final reply, plain text, untrusted
  pulledDigest?: string | null // digest the worker reports it exported, the server always sets it
  pulledImages?: CheckedImage[] // images the worker reports it exported, primary first, the server always sets it
  source?: CheckedSource | null // repository the worker checked out, null without one
}

/** One image a check exported, with the tag sieb knows for its digest */
export interface CheckedImage {
  digest: string
  tag: string | null // null when no instance of the finding names a tag for the digest
}

/** Checks that ended within the last `days` days and their summed Claude usage */
export interface CheckUsageWindow {
  days: number
  checks: number // ended in the window: done, failed or cancelled
  withUsage: number // of those, the checks whose worker reported usage
  inputTokens: number
  outputTokens: number
  cacheTokens: number // cache reads plus cache writes
  costUsd: number | null // sum of the API-equivalent estimates, null when no check reported one
  averageDurationMs: number | null // over the done and failed checks with a duration
}

/** Usage of the ended checks of all users, see CHECK_USAGE_WINDOW_DAYS */
export interface CheckUsageSummary {
  last7Days: CheckUsageWindow
  last30Days: CheckUsageWindow
}

/** GET /api/checks */
export interface ChecksResponse {
  enabled: boolean
  workerOnline: boolean // a worker reached sieb within WORKER_ONLINE_MS
  running: CheckView | null
  queued: CheckView[] // queue order
  recent: CheckView[] // finished or cancelled, newest first, at most MAX_RECENT_CHECKS
  usage?: CheckUsageSummary | null // null while checks are off, the server always sets it
}

/** POST /api/checks body */
export interface CheckCreateRequest {
  findingIds: number[] // 1 to MAX_CHECK_FINDINGS
  force?: boolean // queues findings an open proposal already covers as related findings
}

/** A finding POST /api/checks did not queue */
export interface CheckSkip {
  findingId: number
  reason: CheckSkipReason
  proposalId?: number // the covering open proposal, only for covered_by_proposal
}

/** POST /api/checks answer */
export interface CheckCreateResponse {
  queued: CheckView[]
  skipped: CheckSkip[]
}

/** One image of a claim */
export interface WorkerClaimImage {
  imageRef: string // repository@digest, else repository:tag for the single image of a tag-only finding
  imageDigest: string | null // null only for a pull by tag
  tag: string | null // tag of the most recently seen open instance with this digest
}

/** POST /worker/claim answer when a check is assigned, 204 without body when the queue is empty */
export interface WorkerClaim {
  checkId: number
  findingId: number
  vulnId: string
  imageRef: string // public image to export: repository@digest, else repository:tag, never bare
  imageDigest: string | null // digest of the scanned image, null when sieb only knows the tag
  images?: WorkerClaimImage[] // primary image first, at most MAX_CHECK_IMAGES, absent from older sieb
  prompt: string // investigation prompt built by sieb, the worker appends the workspace layout
  mcpUrl: string // absolute /mcp URL
  token: string // short-lived token of the requester bound to this check's finding, revoked when it ends
  timeoutSeconds: number
  maxTurns: number
}

/** POST /worker/checks/:id/heartbeat body, 409 answers tell the worker to abort (cancelled or timed out) */
export interface WorkerHeartbeat {
  phase: CheckPhase
}

/** POST /worker/checks/:id/result body */
export interface WorkerResult {
  status: 'done' | 'failed'
  error: string | null // short reason, at most MAX_CHECK_ERROR_LENGTH code points
  durationMs: number
  usage: CheckUsage | null
  reply: string | null // Claude's final reply, at most MAX_CHECK_REPLY_LENGTH code points
  pulledDigest?: string | null // digest of the exported primary image, optional
  pulledDigests?: string[] // digests of every exported image, primary first, absent from older workers
  source?: CheckedSource | null // repository checked out for the primary image, absent from older workers
}
