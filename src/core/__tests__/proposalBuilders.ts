import type { ProposalInput, ProposalProposer } from '#core/proposal.ts'

export const PROPOSER: ProposalProposer = {
  proposedBy: 'dev',
  proposedVia: 'token',
  tokenId: 1,
  clientLabel: 'laptop',
  clientKind: 'claude_code_cli',
}

/**
 * Builds a valid raw proposal body as propose_decision passes it to the validation.
 * @param {Record<string, unknown>} overrides - Fields to set
 * @returns {Record<string, unknown>} - Raw input
 */
export const buildRawProposal = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  vulnId: 'CVE-2025-1000',
  scope: 'image',
  imageRefs: ['index.docker.io/library/nginx'],
  verdict: 'not_affected',
  justification: 'vulnerable_code_not_in_execute_path',
  summary: 'The vulnerable parser is never called.',
  confidence: 'medium',
  presence: 'openssl 3.0.1 in /usr/lib',
  reachability: 'Only the CLI uses the parser.',
  exposure: 'Internal only.',
  evidence: [{ check: 'callers of the parser', method: 'grep -r parse_x src/', result: 'none' }],
  fix: {
    action: 'upgrade openssl to 3.0.2',
    fixedVersion: '3.0.2',
    change: 'bump the base image',
    effort: 'small',
  },
  review: { date: '2026-09-01', why: 'next base image release' },
  unknowns: ['runtime flags'],
  references: ['https://example.org/advisory'],
  evidenceBasis: ['advisory', 'image'],
  agent: 'Claude Code',
  ...overrides,
})

/**
 * Builds a validated proposal input with neutral defaults.
 * @param {Partial<ProposalInput>} overrides - Fields to set
 * @returns {ProposalInput} - Input
 */
export const buildProposalInput = (overrides: Partial<ProposalInput> = {}): ProposalInput => ({
  vulnId: 'CVE-2025-1000',
  scope: 'image',
  imageRefs: ['index.docker.io/library/nginx'],
  verdict: 'not_affected',
  justification: 'vulnerable_code_not_in_execute_path',
  summary: 'The vulnerable parser is never called.',
  confidence: 'medium',
  presence: null,
  reachability: null,
  exposure: null,
  evidence: [{ check: 'callers of the parser', method: 'grep -r parse_x src/', result: 'none' }],
  fix: null,
  review: null,
  unknowns: [],
  missing: [],
  references: [],
  evidenceBasis: ['image'],
  agent: null,
  ...overrides,
})
