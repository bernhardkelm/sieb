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

export interface MeResponse {
  username: string | null // null when neither the auth header nor a dev user is present
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
