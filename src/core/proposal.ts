import type { DecisionJustification, DecisionScope, DecisionStatus } from '#core/decision.ts'
import type { SourceAccess } from '#core/sourceAccess.ts'

/** Verdict of a proposal, needs_patch becomes fix_planned with the patch action on accept */
export const PROPOSAL_VERDICTS = ['not_affected', 'accepted', 'fix_planned', 'needs_patch'] as const

export type ProposalVerdict = (typeof PROPOSAL_VERDICTS)[number]

/** Layer that ships the vulnerable component, where the patch action applies */
export const PATCH_LAYERS = ['dependency', 'base_image', 'image', 'platform', 'unknown'] as const

export type PatchLayer = (typeof PATCH_LAYERS)[number]

export const PROPOSAL_CONFIDENCES = ['low', 'medium', 'high'] as const

export type ProposalConfidence = (typeof PROPOSAL_CONFIDENCES)[number]

/** What the evidence of a proposal rests on, at least one */
export const EVIDENCE_BASES = [
  'advisory',
  'upstream_source',
  'image',
  'own_source',
  'runtime',
] as const

export type EvidenceBasis = (typeof EVIDENCE_BASES)[number]

export const PROPOSAL_STATES = ['open', 'accepted', 'rejected', 'superseded'] as const

export type ProposalState = (typeof PROPOSAL_STATES)[number]

export const PROPOSAL_RESOLUTIONS = [
  'accepted',
  'accepted_edited',
  'rejected',
  'replaced',
  'other_accepted',
  'finding_resolved',
] as const

export type ProposalResolution = (typeof PROPOSAL_RESOLUTIONS)[number]

/** How the proposer authenticated on the MCP endpoint */
export type ProposalVia = 'token' | 'oauth'

/** Length and count caps of the proposal fields */
export const PROPOSAL_LIMITS = {
  vulnId: 256,
  imageRefs: 200,
  imageRef: 512,
  summary: 1000,
  narrative: 4000, // presence, reachability, exposure
  evidenceItems: 30,
  evidenceCheck: 500,
  evidenceMethod: 1000,
  evidenceResult: 2000,
  fixAction: 160,
  fixVersion: 200,
  fixChange: 2000,
  fixEffort: 500,
  reviewWhy: 1000,
  unknownItems: 20,
  unknown: 1000,
  references: 20,
  reference: 2000,
  agent: 100,
  rejectReason: 2000,
} as const

/** Open proposals one user may hold at a time */
export const MAX_OPEN_PROPOSALS = 200

/** Target key of a scope all proposal, scope image uses the sorted JSON list of its images */
export const ALL_IMAGES_TARGET_KEY = '*'

export interface ProposalEvidence {
  check: string
  method: string // command, file:line or link
  result: string
}

export interface ProposalFix {
  action: string | null // the patch in one line, required for needs_patch and fix_planned
  layer: PatchLayer | null
  fixedVersion: string | null
  change: string | null // image tag, dependency or pull request to change
  effort: string | null
}

export interface ProposalReview {
  date: string | null // proposed expiry or review date, ISO in UTC
  why: string | null
}

/** Target of a proposal, imageRefs sorted and distinct for scope image, null for scope all */
export interface ProposalTarget {
  vulnId: string
  scope: DecisionScope
  imageRefs: string[] | null
}

/** Validated structured claims of a proposal */
export interface ProposalClaims {
  verdict: ProposalVerdict
  justification: DecisionJustification | null // only with verdict not_affected
  summary: string
  confidence: ProposalConfidence
  presence: string | null
  reachability: string | null
  exposure: string | null
  evidence: ProposalEvidence[]
  fix: ProposalFix | null
  review: ProposalReview | null
  unknowns: string[]
  references: string[] // http(s) URLs
  evidenceBasis: EvidenceBasis[]
}

export interface ProposalInput extends ProposalTarget, ProposalClaims {
  agent: string | null // free label of the client, e.g. Claude Code
}

/** Who filed a proposal, from the MCP caller */
export interface ProposalProposer {
  proposedBy: string
  proposedVia: ProposalVia
  tokenId: number | null
  clientLabel: string
}

/** Governing decision of one target at a point in time, imageRef null for the all-scope target */
export interface ProposalDecisionRef {
  imageRef: string | null
  decisionId: number | null
  updatedAt: string | null
}

export interface ProposalSourceAccess {
  imageRef: string
  access: SourceAccess
}

export interface Proposal extends ProposalInput, ProposalProposer {
  id: number
  sourceAccess: ProposalSourceAccess[] // per target image when proposed
  basisDecisions: ProposalDecisionRef[] // governing decisions when proposed
  state: ProposalState
  resolution: ProposalResolution | null
  resolutionNote: string | null // reject reason
  decisionIds: number[] // decisions created or updated by the accept
  createdAt: string
  resolvedAt: string | null
  resolvedBy: string | null
}

/** Where a decision change came from, recorded as provenance in its event payload */
export interface ProposalProvenance {
  proposalId: number
  proposedBy: string
  clientLabel: string
  editedFields: string[] // fields the reviewer changed before accepting
}

/**
 * Returns the decision status a verdict becomes on accept.
 * @param {ProposalVerdict} verdict - Proposal verdict
 * @returns {DecisionStatus} - needs_patch as fix_planned, the others unchanged
 */
export const statusOfVerdict = (verdict: ProposalVerdict): DecisionStatus =>
  verdict === 'needs_patch' ? 'fix_planned' : verdict

/**
 * Returns the key that identifies the target of a proposal among the open ones of a proposer.
 * @param {Pick<ProposalTarget, 'scope' | 'imageRefs'>} target - Scope and images
 * @returns {string} - '*' for scope all, the sorted JSON image list otherwise
 */
export const proposalTargetKey = (target: Pick<ProposalTarget, 'scope' | 'imageRefs'>): string =>
  target.scope === 'all' || target.imageRefs === null
    ? ALL_IMAGES_TARGET_KEY
    : JSON.stringify([...target.imageRefs].sort())
