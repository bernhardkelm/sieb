import { MAX_REASON_LENGTH } from '#core/decisionFieldReaders.ts'
import type { ProposalClaims, ProposalVerdict } from '#core/proposal.ts'

const VERDICT_LABELS: Record<ProposalVerdict, string> = {
  not_affected: 'Not affected',
  accepted: 'Accepted',
  fix_planned: 'Fix planned',
  needs_patch: 'Needs patch',
}

const KEY_EVIDENCE = 3

const EVIDENCE_PART_LENGTH = 300

const ELLIPSIS = '…'

type ReasonClaims = Pick<
  ProposalClaims,
  'verdict' | 'justification' | 'summary' | 'confidence' | 'evidence' | 'fix' | 'evidenceBasis'
>

/**
 * Shortens text to a length, ending in an ellipsis when cut.
 * @param {string} text - Text
 * @param {number} max - Longest result
 * @returns {string} - Text of at most max characters
 */
const shorten = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - ELLIPSIS.length).trimEnd()}${ELLIPSIS}`

/**
 * Puts text on one line.
 * @param {string} text - Text
 * @returns {string} - Text with runs of whitespace as single spaces
 */
const oneLine = (text: string): string => text.replaceAll(/\s+/gu, ' ').trim()

/**
 * Generates the reason of the decision a proposal becomes: the verdict with its justification
 * and the summary, the first evidence checks with their results, the fix path when one is
 * given, and the confidence with the evidence basis, at most MAX_REASON_LENGTH characters.
 * @param {ReasonClaims} claims - Validated claims of the proposal
 * @returns {string} - Decision reason, editable before accepting
 */
export const generateProposalReason = (claims: ReasonClaims): string => {
  const verdict = claims.justification
    ? `${VERDICT_LABELS[claims.verdict]} (${claims.justification})`
    : VERDICT_LABELS[claims.verdict]
  const lines = [`${verdict}: ${oneLine(claims.summary)}`]
  const evidence = claims.evidence
    .slice(0, KEY_EVIDENCE)
    .map((item) => shorten(oneLine(`${item.check}: ${item.result}`), EVIDENCE_PART_LENGTH))

  if (evidence.length > 0) {
    lines.push(`Evidence: ${evidence.join('; ')}`)
  }

  if (claims.fix?.change) {
    lines.push(`Fix: ${oneLine(claims.fix.change)}`)
  }

  const tail = `Confidence ${claims.confidence}, evidence basis ${claims.evidenceBasis.join(', ')}.`

  return `${shorten(lines.join('\n'), MAX_REASON_LENGTH - tail.length - 1)}\n${tail}`
}
