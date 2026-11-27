import type { DecisionJustification } from '#core/decision.ts'
import type {
  EvidenceBasis,
  ProposalConfidence,
  ProposalEvidence,
  ProposalFix,
  ProposalResolution,
  ProposalState,
  ProposalTarget,
  ProposalVerdict,
} from '#core/proposal.ts'
import type { ProposalClientKind } from '#core/proposalClient.ts'
import type { ImageAccess } from '#core/imageVisibility.ts'

/** How the proposer authenticated on the MCP endpoint */
export type ProposalVia = 'token' | 'oauth'

/** Open proposals one user may hold at a time */
export const MAX_OPEN_PROPOSALS = 200

/** Target key of a scope all proposal, scope image uses the sorted JSON list of its images */
export const ALL_IMAGES_TARGET_KEY = '*'

export interface ProposalReview {
  date: string | null // proposed expiry or review date, ISO in UTC
  why: string | null
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
  missing: string[] // what is needed to decide, only with verdict inconclusive, empty otherwise
  references: string[] // http(s) URLs
  evidenceBasis: EvidenceBasis[]
}

/** Another open finding Claude verified shares the cause of the verdict, decided separately */
export interface ProposalRelatedFinding {
  findingId: number
  note: string | null
}

export interface ProposalInput extends ProposalTarget, ProposalClaims {
  agent: string | null // free label of the client, e.g. Claude Code
  relatedFindings: ProposalRelatedFinding[] // never decided by an accept of the proposal
  relatedReason: string | null // the shared cause, only with relatedFindings
}

/** Who filed a proposal, from the MCP caller */
export interface ProposalProposer {
  proposedBy: string
  proposedVia: ProposalVia
  tokenId: number | null
  clientLabel: string
  clientKind: ProposalClientKind | null // null when unknown or filed before sieb recorded it
}

/** Governing decision of one target at a point in time, imageRef null for the all-scope target */
export interface ProposalDecisionRef {
  imageRef: string | null
  decisionId: number | null
  updatedAt: string | null
}

/** Visibility and ownership of one target image when proposed */
export interface ProposalImageAccess extends ImageAccess {
  imageRef: string
}

export interface Proposal extends ProposalInput, ProposalProposer {
  id: number
  imageAccess: ProposalImageAccess[] // per target image when proposed
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
 * Returns the key that identifies the target of a proposal among the open ones of a proposer.
 * @param {Pick<ProposalTarget, 'scope' | 'imageRefs'>} target - Scope and images
 * @returns {string} - '*' for scope all, the sorted JSON image list otherwise
 */
export const proposalTargetKey = (target: Pick<ProposalTarget, 'scope' | 'imageRefs'>): string =>
  target.scope === 'all' || target.imageRefs === null
    ? ALL_IMAGES_TARGET_KEY
    : JSON.stringify([...target.imageRefs].sort())
