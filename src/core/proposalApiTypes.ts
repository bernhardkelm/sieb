import type { Decision } from '#core/decision.ts'
import type { EffectiveDecision } from '#core/effectiveDecision.ts'
import type { Exposure } from '#core/exposure.ts'
import type { DecisionView } from '#core/findingView.ts'
import type { PackageVersion } from '#core/instance.ts'
import type { KevDetails } from '#core/kev.ts'
import type { ProposalState } from '#core/proposal.ts'
import type { AcceptedDecisionValues } from '#core/proposalAccept.ts'
import type { ExpectedDecisionId } from '#core/proposalFreshness.ts'
import type { ProposalView } from '#core/proposalView.ts'
import type { Severity } from '#core/severity.ts'
import type { SourceAccess } from '#core/sourceAccess.ts'

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

/** sieb's facts on a finding a proposal says shares its cause, decided apart from the proposal */
export interface ProposalRelatedFacts {
  findingId: number
  note: string | null // Claude's note, untrusted plain text
  vulnId: string | null // null once sieb no longer holds the finding
  imageRef: string | null
  open: boolean
  sourceAccess: SourceAccess | null
  versions: PackageVersion[] // package, installed and fixed version of the current instances
  decision: Decision | null // decision governing the finding now
  effective: EffectiveDecision | null
}

/** Answer of GET /api/proposals/:id */
export interface ProposalDetail extends ProposalListItem {
  images: ProposalImageFacts[] // scope image: the targets, scope all: every image with an open finding
  allScopeDecision: DecisionView | null // current all-scope decision of the vulnerability
  currentDecisionIds: ExpectedDecisionId[] // governing decision per target, send as expectedDecisionIds
  decisionValues: AcceptedDecisionValues | null // what accepting without edits writes, prefill of Edit & accept, null for inconclusive
  kevCatalog: KevDetails | null // CISA catalog entry, null for other KEV sources and unlisted CVEs
  related: ProposalRelatedFacts[] // the proposal's related findings in its order
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
