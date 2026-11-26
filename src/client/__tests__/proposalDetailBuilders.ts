import type { ProposalDetail, ProposalImageFacts, ProposalListItem } from '#core/apiTypes.ts'
import { buildDecision } from '#core/__tests__/coreBuilders.ts'
import { buildProposalInput, PROPOSER } from '#core/__tests__/proposalBuilders.ts'
import type { DecisionStatus } from '#core/decision.ts'
import type { DecisionView } from '#core/findingView.ts'
import { toProposalView, type ProposalView } from '#core/proposalView.ts'

export const IMAGE = 'index.docker.io/library/nginx'

export const OWN_IMAGE = 'registry.example.com/acme/shop'

/**
 * Builds an open proposal as the API shows it, with neutral defaults, one image, filed by dev via
 * laptop.
 * @param {Partial<ProposalView>} overrides - Fields to set
 * @returns {ProposalView} - Proposal
 */
export const buildProposal = (overrides: Partial<ProposalView> = {}): ProposalView => ({
  ...toProposalView({
    ...buildProposalInput({ agent: 'Claude Code' }),
    ...PROPOSER,
    id: 7,
    sourceAccess: [{ imageRef: IMAGE, access: 'public' }],
    basisDecisions: [{ imageRef: IMAGE, decisionId: null, updatedAt: null }],
    state: 'open',
    resolution: null,
    resolutionNote: null,
    decisionIds: [],
    createdAt: '2026-11-26T10:00:00.000Z',
    resolvedAt: null,
    resolvedBy: null,
  }),
  ...overrides,
})

/**
 * Builds an active decision view of an image.
 * @param {DecisionStatus} status - Decision status
 * @param {Partial<DecisionView['decision']>} overrides - Decision fields to set
 * @returns {DecisionView} - Decision with its state
 */
export const buildDecisionView = (
  status: DecisionStatus,
  overrides: Partial<DecisionView['decision']> = {},
): DecisionView => ({
  decision: buildDecision({ id: 11, status, ...overrides }),
  effective: status === 'fix_planned' ? { state: 'fix_planned' } : { state: 'active' },
  openFindings: 1,
})

/**
 * Builds sieb's facts on one image, open and undecided.
 * @param {Partial<ProposalImageFacts>} overrides - Fields to set
 * @returns {ProposalImageFacts} - Facts
 */
export const buildImageFacts = (
  overrides: Partial<ProposalImageFacts> = {},
): ProposalImageFacts => ({
  imageRef: IMAGE,
  findingId: 1,
  open: true,
  severity: 'High',
  score: 7.5,
  kev: false,
  exposure: 'internal',
  owner: 'platform',
  sourceAccess: 'public',
  versions: [{ package: 'libssl3', installedVersion: '3.0.1', fixedVersion: '3.0.2' }],
  workloads: ['web/Deployment/nginx'],
  decision: null,
  ...overrides,
})

/**
 * Builds the list item of a proposal.
 * @param {Partial<ProposalView>} overrides - Proposal fields to set
 * @returns {ProposalListItem} - List item
 */
export const buildProposalItem = (overrides: Partial<ProposalView> = {}): ProposalListItem => ({
  proposal: buildProposal(overrides),
  outdated: false,
  severity: 'High',
  kev: false,
  imageCount: 1,
})

/**
 * Builds the review detail of an open, undecided single-image proposal.
 * @param {Partial<ProposalDetail>} overrides - Fields to set
 * @returns {ProposalDetail} - Detail
 */
export const buildProposalDetail = (overrides: Partial<ProposalDetail> = {}): ProposalDetail => ({
  proposal: buildProposal(),
  outdated: false,
  severity: 'High',
  kev: false,
  imageCount: 1,
  images: [buildImageFacts()],
  allScopeDecision: null,
  currentDecisionIds: [{ imageRef: IMAGE, decisionId: null, updatedAt: null }],
  decisionValues: {
    status: 'not_affected',
    justification: 'vulnerable_code_not_in_execute_path',
    reason: 'Not affected (high confidence): The vulnerable parser is never called.',
    expiresAt: '2027-05-26T10:00:00.000Z',
  },
  kevCatalog: null,
  ...overrides,
})
