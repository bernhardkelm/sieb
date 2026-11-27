import type { ValidationIssue } from '#core/apiTypes.ts'
import { DECISION_SCOPES, type DecisionScope } from '#core/decision.ts'
import { isPatchVerdict } from '#core/patchAction.ts'
import {
  EVIDENCE_BASES,
  PROPOSAL_CONFIDENCES,
  PROPOSAL_LIMITS as LIMITS,
  PROPOSAL_VERDICTS,
  type ProposalInput,
} from '#core/proposal.ts'
import { readEvidence, readFix, readReferences, readReview } from '#core/proposalStructReaders.ts'
import { readProposalEnum, readProposalList, readProposalText } from '#core/proposalTextReaders.ts'
import { readMissing, readProposalJustification } from '#core/proposalVerdictReaders.ts'

export type ProposalValidated<T> = { ok: true; value: T } | { ok: false; errors: ValidationIssue[] }

type RawInput = Record<string, unknown>

/**
 * Reads the target images: for scope image 1 to PROPOSAL_LIMITS.imageRefs non-blank refs,
 * distinct and sorted; scope all must not name images.
 * @param {RawInput} raw - Raw input
 * @param {DecisionScope | null} scope - Validated scope
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {string[] | null} - Sorted image refs, null for scope all or on errors
 */
const readImageRefs = (
  raw: RawInput,
  scope: DecisionScope | null,
  errors: ValidationIssue[],
): string[] | null => {
  if (scope === 'all') {
    if (raw.imageRefs !== undefined && raw.imageRefs !== null) {
      errors.push({ field: 'imageRefs', code: 'not_allowed' })
    }

    return null
  }

  const refs = readProposalList(
    raw.imageRefs,
    'imageRefs',
    LIMITS.imageRefs,
    (item, field) =>
      readProposalText(item, field, { max: LIMITS.imageRef, required: true }, errors),
    errors,
  )

  if (scope === 'image' && refs.length === 0 && !errors.some((e) => e.field === 'imageRefs')) {
    errors.push({ field: 'imageRefs', code: 'required' })
  }

  return [...new Set(refs)].sort()
}

/**
 * Validates a proposal: target, verdict with its justification, the structured claims with
 * their caps, references as http(s) URLs and a non-empty evidence basis. Free text loses
 * control and bidirectional formatting characters; needs_patch and fix_planned need a patch
 * action, inconclusive needs the list of what is missing to decide, which no other verdict
 * may carry.
 * @param {RawInput} raw - Raw input
 * @param {Date} now - Current time, for the review date
 * @returns {ProposalValidated<ProposalInput>} - Validated input or the list of errors
 */
export const validateProposalInput = (
  raw: RawInput,
  now: Date,
): ProposalValidated<ProposalInput> => {
  const errors: ValidationIssue[] = []
  const vulnId = readProposalText(
    raw.vulnId,
    'vulnId',
    { max: LIMITS.vulnId, required: true },
    errors,
  )
  const scope = readProposalEnum(raw.scope, DECISION_SCOPES, 'scope', errors)
  const imageRefs = readImageRefs(raw, scope, errors)
  const verdict = readProposalEnum(raw.verdict, PROPOSAL_VERDICTS, 'verdict', errors)
  const justification = readProposalJustification(raw.justification, verdict, errors)
  const summary = readProposalText(
    raw.summary,
    'summary',
    { max: LIMITS.summary, multiline: true, required: true },
    errors,
  )
  const confidence = readProposalEnum(raw.confidence, PROPOSAL_CONFIDENCES, 'confidence', errors)
  const narrative = { max: LIMITS.narrative, multiline: true }
  const fix = readFix(raw.fix, errors)
  const evidenceBasis = readProposalList(
    raw.evidenceBasis,
    'evidenceBasis',
    EVIDENCE_BASES.length,
    (item, field) => readProposalEnum(item, EVIDENCE_BASES, field, errors),
    errors,
  )

  if (evidenceBasis.length === 0 && !errors.some((e) => e.field?.startsWith('evidenceBasis'))) {
    errors.push({ field: 'evidenceBasis', code: 'required' })
  }

  if (
    verdict !== null &&
    isPatchVerdict(verdict) &&
    (fix === null || fix.action === null) &&
    !errors.some((e) => e.field === 'fix.action')
  ) {
    errors.push({ field: 'fix.action', code: 'required' })
  }

  const input = {
    vulnId,
    scope,
    imageRefs,
    verdict,
    justification,
    summary,
    confidence,
    presence: readProposalText(raw.presence, 'presence', narrative, errors),
    reachability: readProposalText(raw.reachability, 'reachability', narrative, errors),
    exposure: readProposalText(raw.exposure, 'exposure', narrative, errors),
    evidence: readProposalList(
      raw.evidence,
      'evidence',
      LIMITS.evidenceItems,
      (item, field) => readEvidence(item, field, errors),
      errors,
    ),
    fix,
    review: readReview(raw.review, now, errors),
    unknowns: readProposalList(
      raw.unknowns,
      'unknowns',
      LIMITS.unknownItems,
      (item, field) =>
        readProposalText(item, field, { max: LIMITS.unknown, multiline: true }, errors),
      errors,
    ),
    missing: readMissing(raw.missing, verdict, errors),
    references: readReferences(raw.references, errors),
    evidenceBasis: [...new Set(evidenceBasis)],
    agent: readProposalText(raw.agent, 'agent', { max: LIMITS.agent }, errors),
  }

  if (
    errors.length > 0 ||
    vulnId === null ||
    scope === null ||
    verdict === null ||
    summary === null ||
    confidence === null
  ) {
    return { ok: false, errors }
  }

  return { ok: true, value: { ...input, vulnId, scope, verdict, summary, confidence } }
}
