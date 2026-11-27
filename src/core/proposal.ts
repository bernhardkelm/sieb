import {
  WAITING_FOR_MAX_LENGTH,
  type DecisionJustification,
  type DecisionScope,
  type DecisionStatus,
} from '#core/decision.ts'
import type { ProposalClientKind } from '#core/proposalClient.ts'
import type { SourceAccess } from '#core/sourceAccess.ts'

/**
 * Verdict of a proposal, needs_patch becomes fix_planned with the patch action on accept;
 * inconclusive names what is missing to decide and never becomes a decision of its own
 */
export const PROPOSAL_VERDICTS = [
  'not_affected',
  'accepted',
  'fix_planned',
  'needs_patch',
  'inconclusive',
] as const

export type ProposalVerdict = (typeof PROPOSAL_VERDICTS)[number]

/** The verdict that only reports what is missing to decide */
export const INCONCLUSIVE_VERDICT = 'inconclusive' satisfies ProposalVerdict

/** Verdicts that become a decision on accept */
export type DecidableVerdict = Exclude<ProposalVerdict, typeof INCONCLUSIVE_VERDICT>

/** Layer that ships the vulnerable component, where the patch action applies */
export const PATCH_LAYERS = ['dependency', 'base_image', 'image', 'platform', 'unknown'] as const

export type PatchLayer = (typeof PATCH_LAYERS)[number]

/**
 * Whether a fix is published today at a layer the operator controls, or the patch waits for an
 * upstream release
 */
export const FIX_AVAILABILITIES = ['available', 'upstream_pending'] as const

export type FixAvailability = (typeof FIX_AVAILABILITIES)[number]

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
  waitingFor: WAITING_FOR_MAX_LENGTH,
  interimAction: 160,
  interimSteps: 2000,
  interimCaveats: 2000,
  reviewWhy: 1000,
  unknownItems: 20,
  unknown: 1000,
  missingItems: 10,
  missing: 1000,
  references: 20,
  reference: 2000,
  agent: 100,
  rejectReason: 2000,
  relatedFindings: 50,
  relatedNote: 1000, // as an unknown
  relatedReason: 1000, // as the summary
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

/** Advised manual workaround while no upstream fix exists, only for urgent cases */
export interface ProposalInterim {
  action: string
  steps: string | null
  caveats: string // what it risks and when to revert it
}

export interface ProposalFix {
  action: string | null // the patch in one line, required for needs_patch and fix_planned
  layer: PatchLayer | null
  fixedVersion: string | null
  change: string | null // image tag, dependency or pull request to change
  effort: string | null
  availability: FixAvailability | null // null for other verdicts and proposals stored before it existed
  waitingFor: string | null // only with upstream_pending
  interim: ProposalInterim | null // only with upstream_pending
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
 * Returns whether a verdict becomes a decision on accept, every verdict but inconclusive.
 * @param {ProposalVerdict} verdict - Proposal verdict
 * @returns {boolean} - False for inconclusive
 */
export const isDecidableVerdict = (verdict: ProposalVerdict): verdict is DecidableVerdict =>
  verdict !== INCONCLUSIVE_VERDICT

/**
 * Returns the decision status a verdict becomes on accept.
 * @param {DecidableVerdict} verdict - Proposal verdict other than inconclusive
 * @returns {DecisionStatus} - needs_patch as fix_planned, the others unchanged
 */
export const statusOfVerdict = (verdict: DecidableVerdict): DecisionStatus =>
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
