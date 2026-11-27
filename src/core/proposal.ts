import { WAITING_FOR_MAX_LENGTH, type DecisionScope, type DecisionStatus } from '#core/decision.ts'

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

/** Target of a proposal, imageRefs sorted and distinct for scope image, null for scope all */
export interface ProposalTarget {
  vulnId: string
  scope: DecisionScope
  imageRefs: string[] | null
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
