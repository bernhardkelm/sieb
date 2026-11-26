import type { Decision } from '#core/decision.ts'
import { selectApplicableDecision } from '#core/decisionApplicability.ts'
import type { ProposalDecisionRef, ProposalTarget } from '#core/proposal.ts'

type DecisionFields = Pick<
  Decision,
  'id' | 'vulnId' | 'scope' | 'imageRef' | 'revokedAt' | 'updatedAt'
>

/** Decision and its version a reviewer saw per target, sent back on accept */
export type ExpectedDecisionId = Pick<ProposalDecisionRef, 'imageRef' | 'decisionId' | 'updatedAt'>

/**
 * Returns the reference of a decision, or of no decision, for one target.
 * @param {string | null} imageRef - Target image, null for the all-scope target
 * @param {DecisionFields | null | undefined} decision - Current decision
 * @returns {ProposalDecisionRef} - Reference
 */
const refOf = (
  imageRef: string | null,
  decision: DecisionFields | null | undefined,
): ProposalDecisionRef => ({
  imageRef,
  decisionId: decision?.id ?? null,
  updatedAt: decision?.updatedAt ?? null,
})

/**
 * Lists the decisions that currently govern the targets of a proposal: per target image the
 * decision that applies to it, an all-scope decision included, or for scope all the current
 * all-scope decision of the vulnerability.
 * @param {ProposalTarget} target - Vulnerability, scope and images
 * @param {readonly DecisionFields[]} decisions - Decisions of the vulnerability, revoked ones included
 * @returns {ProposalDecisionRef[]} - One reference per target, sorted by image ref
 */
export const currentDecisionRefs = (
  target: ProposalTarget,
  decisions: readonly DecisionFields[],
): ProposalDecisionRef[] => {
  if (target.scope === 'all' || target.imageRefs === null) {
    const current = decisions.find(
      (decision) =>
        decision.vulnId === target.vulnId &&
        decision.scope === 'all' &&
        decision.revokedAt === null,
    )

    return [refOf(null, current)]
  }

  return [...target.imageRefs]
    .sort()
    .map((imageRef) =>
      refOf(imageRef, selectApplicableDecision(decisions, { vulnId: target.vulnId, imageRef })),
    )
}

/**
 * Returns a lookup key of a target reference.
 * @param {string | null} imageRef - Target image, null for the all-scope target
 * @returns {string} - Key
 */
const targetKey = (imageRef: string | null): string => JSON.stringify(imageRef)

/**
 * Returns whether a proposal is outdated: the governing decision of a target is another one, or
 * the same one was changed or revoked since the proposal was filed.
 * @param {readonly ProposalDecisionRef[]} basis - References when proposed
 * @param {readonly ProposalDecisionRef[]} current - References now
 * @returns {boolean} - True when a human changed a decision on the target meanwhile
 */
export const isProposalOutdated = (
  basis: readonly ProposalDecisionRef[],
  current: readonly ProposalDecisionRef[],
): boolean => {
  const before = new Map(basis.map((ref) => [targetKey(ref.imageRef), ref]))

  return current.some((ref) => {
    const old = before.get(targetKey(ref.imageRef))

    return old === undefined || old.decisionId !== ref.decisionId || old.updatedAt !== ref.updatedAt
  })
}

/**
 * Returns whether the decisions a reviewer expected are exactly the current ones, one per target
 * and none besides, each in the version the reviewer saw: same id and same updatedAt, so a
 * decision edited in place meanwhile does not match.
 * @param {readonly ExpectedDecisionId[]} expected - Entries sent with the accept
 * @param {readonly ExpectedDecisionId[]} current - References now
 * @returns {boolean} - True when they match
 */
export const matchesExpectedDecisions = (
  expected: readonly ExpectedDecisionId[],
  current: readonly ExpectedDecisionId[],
): boolean => {
  const wanted = new Map(expected.map((ref) => [targetKey(ref.imageRef), ref]))

  return (
    wanted.size === expected.length &&
    wanted.size === current.length &&
    current.every((ref) => {
      const seen = wanted.get(targetKey(ref.imageRef))

      return (
        seen !== undefined && seen.decisionId === ref.decisionId && seen.updatedAt === ref.updatedAt
      )
    })
  )
}

/**
 * Returns whether two lists of expected decisions name the same decision version per target.
 * @param {readonly ExpectedDecisionId[]} left - One list
 * @param {readonly ExpectedDecisionId[]} right - Other list
 * @returns {boolean} - True when they match regardless of order
 */
export const sameExpectedDecisionIds = (
  left: readonly ExpectedDecisionId[],
  right: readonly ExpectedDecisionId[],
): boolean => matchesExpectedDecisions(left, right)
