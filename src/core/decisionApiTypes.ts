import type { BulkDecisionInput } from '#core/bulkDecisionValidation.ts'
import type { DecisionInput, DecisionPatch } from '#core/decision.ts'
import type { DecisionView } from '#core/findingView.ts'

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
export type DecisionRequest = Omit<
  DecisionInput,
  'expiresAt' | 'imageRef' | 'justification' | 'upstreamPending' | 'waitingFor'
> & {
  imageRef?: string | null
  expiresAt?: string | null
  justification?: DecisionInput['justification']
  upstreamPending?: boolean
  waitingFor?: string | null
}

/** Body of PATCH /api/decisions/:id, reconfirm true clears a re-open and records new baselines */
export type DecisionPatchRequest = Omit<DecisionPatch, 'reconfirm'> & { reconfirm?: boolean }

/** Body of POST /api/decisions/bulk */
export type BulkDecisionRequest = Omit<
  BulkDecisionInput,
  'expiresAt' | 'justification' | 'upstreamPending' | 'waitingFor'
> & {
  expiresAt?: string | null
  justification?: BulkDecisionInput['justification']
  upstreamPending?: boolean
  waitingFor?: string | null
}
