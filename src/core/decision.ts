import type { DecisionBaseline, ReopenTrigger } from '#core/reopenTrigger.ts'
import type { Severity } from '#core/severity.ts'

export const DECISION_STATUSES = ['not_affected', 'accepted', 'fix_planned'] as const

export type DecisionStatus = (typeof DECISION_STATUSES)[number]

export const DECISION_SCOPES = ['image', 'all'] as const

export type DecisionScope = (typeof DECISION_SCOPES)[number]

/** Validated input for a new decision */
export interface DecisionInput {
  vulnId: string
  scope: DecisionScope
  imageRef: string | null // set for scope image, null for scope all
  status: DecisionStatus
  reason: string
  expiresAt: string | null
}

/** Validated change of an existing decision, absent fields stay as they are */
export interface DecisionPatch {
  status?: DecisionStatus
  reason?: string
  expiresAt?: string | null
  reconfirm?: true // clears a re-open and records new baselines
}

export interface Decision {
  id: number
  vulnId: string
  scope: DecisionScope
  imageRef: string | null
  status: DecisionStatus
  reason: string
  expiresAt: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  revokedAt: string | null
  revokedBy: string | null
  severityAtDecision: Severity // highest baseline when decided or re-confirmed, for display
  kevAtDecision: boolean // any baseline KEV listed, for display
  reopenedAt: string | null // set by the sync that detected the re-open, cleared by a re-confirm
  reopenTrigger: ReopenTrigger | null // set together with reopenedAt
  baselines: DecisionBaseline[] // per governed image, sorted by image_ref
}
