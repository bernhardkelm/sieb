import type { DecisionJustification } from '#core/decision.ts'
import { patchActionOf } from '#core/patchAction.ts'
import { isDecidableVerdict, type ProposalState, type ProposalVerdict } from '#core/proposal.ts'
import type { ProposalView } from '#core/proposalView.ts'
import { JUSTIFICATION_LABELS } from '@/format/labels'
import { proposalClientLabel } from '@/format/proposalClientLabel'
import { PROPOSAL_STATE_LABELS, RESOLUTION_LABELS, VERDICT_LABELS } from '@/format/proposalLabels'

const SAFE_PROTOCOLS = ['http:', 'https:']

/** Claude-written text longer than this starts collapsed */
export const COLLAPSE_CHARACTERS = 480

/** Claude-written text with more lines than this starts collapsed */
export const COLLAPSE_LINES = 6

/**
 * Returns the label of a verdict, a not_affected one with its justification.
 * @param {ProposalVerdict} verdict - Verdict
 * @param {DecisionJustification | null} justification - VEX justification
 * @returns {string} - Such as "Not affected · vulnerable code not in execute path"
 */
export const verdictLabel = (
  verdict: ProposalVerdict,
  justification: DecisionJustification | null,
): string => {
  const label = VERDICT_LABELS[verdict]

  if (verdict !== 'not_affected' || justification === null) {
    return label
  }

  const text = JUSTIFICATION_LABELS[justification]

  return `${label} · ${text.charAt(0).toLowerCase()}${text.slice(1)}`
}

/**
 * Returns who proposed and through which client.
 * @param {Pick<ProposalView, 'proposedBy' | 'clientKind' | 'agent' | 'clientLabel'>} proposal - Proposer fields
 * @returns {string} - Such as "Proposed by alice via Claude Code (CLI)"
 */
export const proposerLine = (
  proposal: Pick<ProposalView, 'proposedBy' | 'clientKind' | 'agent' | 'clientLabel'>,
): string => `Proposed by ${proposal.proposedBy} via ${proposalClientLabel(proposal)}`

/** How an inconclusive proposal closed by the reviewer reads, it was never accepted as proposed */
const INCONCLUSIVE_CLOSED: Partial<Record<ProposalState, string>> = {
  accepted: 'Decided',
  rejected: 'Dismissed',
}

/**
 * Returns the label of the state of a proposal, an inconclusive one reads as decided or dismissed.
 * @param {Pick<ProposalView, 'state' | 'verdict'>} proposal - State and verdict
 * @returns {string} - Such as "Rejected", or "Dismissed" for inconclusive
 */
export const proposalStateLabel = (proposal: Pick<ProposalView, 'state' | 'verdict'>): string =>
  (isDecidableVerdict(proposal.verdict) ? undefined : INCONCLUSIVE_CLOSED[proposal.state]) ??
  PROPOSAL_STATE_LABELS[proposal.state]

/**
 * Returns whether the review panel shows the What to do section: a patch action or fix steps,
 * never for inconclusive, which lists what is missing in its place.
 * @param {Pick<ProposalView, 'verdict' | 'fix'>} proposal - Verdict and fix path
 * @returns {boolean} - True when there is something to do
 */
export const hasWhatToDo = (proposal: Pick<ProposalView, 'verdict' | 'fix'>): boolean =>
  isDecidableVerdict(proposal.verdict) &&
  (patchActionOf(proposal) !== null || Boolean(proposal.fix?.change))

/**
 * Describes how a closed proposal ended.
 * @param {ProposalView} proposal - Proposal, state other than open
 * @returns {string} - Such as "Accepted with edits by bob"
 */
export const resolutionLine = (proposal: ProposalView): string => {
  const what =
    proposal.resolution === null ||
    (!isDecidableVerdict(proposal.verdict) && INCONCLUSIVE_CLOSED[proposal.state] !== undefined)
      ? proposalStateLabel(proposal)
      : RESOLUTION_LABELS[proposal.resolution]
  const by =
    proposal.resolvedBy === null || proposal.resolvedBy === 'sieb'
      ? ''
      : ` by ${proposal.resolvedBy}`

  return `${what}${by}`
}

/**
 * Keeps the references that are http(s) URLs, the server checks them, the panel never links others.
 * Each one comes back normalized as the URL parser writes it, with a punycode host, so a lookalike
 * host such as one with a Cyrillic letter shows as xn--; duplicates after normalizing collapse.
 * @param {readonly string[]} references - Raw references
 * @returns {string[]} - Safe normalized links
 */
export const safeReferences = (references: readonly string[]): string[] => {
  const links = references.flatMap((reference) => {
    if (!URL.canParse(reference)) {
      return []
    }

    const url = new URL(reference)

    return SAFE_PROTOCOLS.includes(url.protocol) ? [url.href] : []
  })

  return [...new Set(links)]
}

/**
 * Returns whether a Claude-written text is long enough to start collapsed.
 * @param {string} text - Plain text
 * @returns {boolean} - True above the character or line limit
 */
export const isLongText = (text: string): boolean =>
  text.length > COLLAPSE_CHARACTERS || text.split('\n').length > COLLAPSE_LINES
