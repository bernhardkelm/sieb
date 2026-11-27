import type { DecisionBaseline, ReopenTrigger } from '#core/reopenTrigger.ts'
import type { Severity } from '#core/severity.ts'

export const DECISION_STATUSES = ['not_affected', 'accepted', 'fix_planned'] as const

export type DecisionStatus = (typeof DECISION_STATUSES)[number]

/** OpenVEX justifications of a not_affected decision */
export const DECISION_JUSTIFICATIONS = [
  'component_not_present',
  'vulnerable_code_not_present',
  'vulnerable_code_not_in_execute_path',
  'vulnerable_code_cannot_be_controlled_by_adversary',
  'inline_mitigations_already_exist',
] as const

export type DecisionJustification = (typeof DECISION_JUSTIFICATIONS)[number]

/** The only status that may carry a justification */
export const JUSTIFIABLE_STATUS: DecisionStatus = 'not_affected'

export const DECISION_SCOPES = ['image', 'all'] as const

export type DecisionScope = (typeof DECISION_SCOPES)[number]

/** The only status that may wait for upstream */
export const UPSTREAM_STATUS: DecisionStatus = 'fix_planned'

/** Longest waitingFor text of a decision or proposal */
export const WAITING_FOR_MAX_LENGTH = 160

/** Validated input for a new decision */
export interface DecisionInput {
  vulnId: string
  scope: DecisionScope
  imageRef: string | null // set for scope image, null for scope all
  status: DecisionStatus
  justification: DecisionJustification | null // only with status not_affected
  reason: string
  expiresAt: string | null
  upstreamPending: boolean // fix_planned waiting for an upstream release, needs waitingFor and an expiry
  waitingFor: string | null // only with upstreamPending
}

/** Validated change of an existing decision, absent fields stay as they are */
export interface DecisionPatch {
  status?: DecisionStatus
  justification?: DecisionJustification | null // null clears it
  reason?: string
  expiresAt?: string | null
  upstreamPending?: boolean
  waitingFor?: string | null // null clears it
  reconfirm?: true // clears a re-open and records new baselines
}

export interface Decision {
  id: number
  vulnId: string
  scope: DecisionScope
  imageRef: string | null
  status: DecisionStatus
  justification: DecisionJustification | null // cleared when the status leaves not_affected
  reason: string
  expiresAt: string | null
  upstreamPending: boolean // cleared when the status leaves fix_planned
  waitingFor: string | null // set exactly while upstreamPending
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
