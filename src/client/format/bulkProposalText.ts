import type { BulkProposalOutcome, BulkProposalResult } from '#core/proposalBulk.ts'

type SkipOutcome = Exclude<BulkProposalOutcome, 'accepted' | 'rejected'>

const SKIP_LABELS: Record<SkipOutcome, string> = {
  outdated: 'outdated',
  inconclusive: 'inconclusive',
  not_acceptable: 'not acceptable',
  not_open: 'already closed',
  not_found: 'not found',
}

const LISTED_SKIPS = 5

export interface BulkResultText {
  title: string
  description: string | undefined
  /** Whether any proposal was written, a toast without writes is a notice */
  wrote: boolean
}

/**
 * Returns whether an outcome is a skip.
 * @param {BulkProposalOutcome} outcome - Outcome
 * @returns {boolean} - True for every outcome but accepted and rejected
 */
const isSkip = (outcome: BulkProposalOutcome): outcome is SkipOutcome =>
  outcome !== 'accepted' && outcome !== 'rejected'

/**
 * Names the reasons of the skipped proposals: the label alone for one reason, else the count
 * per reason in the order of the first skip.
 * @param {readonly SkipOutcome[]} skips - Outcomes of the skipped proposals
 * @returns {string} - Such as "outdated" or "2 outdated, 1 inconclusive"
 */
const reasonsText = (skips: readonly SkipOutcome[]): string => {
  const counts = new Map<SkipOutcome, number>()

  for (const skip of skips) {
    counts.set(skip, (counts.get(skip) ?? 0) + 1)
  }

  return counts.size === 1
    ? SKIP_LABELS[skips[0]!]
    : [...counts].map(([skip, count]) => `${count} ${SKIP_LABELS[skip]}`).join(', ')
}

/**
 * Lists the skipped proposals by CVE with their reason, the first five and how many more.
 * @param {readonly BulkProposalResult[]} skipped - Skipped results
 * @returns {string} - Such as "CVE-2025-1 outdated, CVE-2025-2 inconclusive and 3 more"
 */
const skippedList = (skipped: readonly BulkProposalResult[]): string => {
  const listed = skipped
    .slice(0, LISTED_SKIPS)
    .map(
      (result) =>
        `${result.vulnId ?? `#${result.id}`} ${SKIP_LABELS[result.outcome as SkipOutcome]}`,
    )
    .join(', ')
  const more = skipped.length - LISTED_SKIPS

  return more > 0 ? `${listed} and ${more} more` : listed
}

/**
 * Builds the toast of a bulk accept or reject: "Accepted 4, skipped 1 (outdated)" with the
 * skipped proposals listed below, or "Rejected 3" when nothing was skipped.
 * @param {string} verb - Past tense of the action, Accepted or Rejected
 * @param {readonly BulkProposalResult[]} results - Results of the batch
 * @returns {BulkResultText} - Title, description and whether anything was written
 */
export const bulkResultText = (
  verb: string,
  results: readonly BulkProposalResult[],
): BulkResultText => {
  const skipped = results.filter((result) => isSkip(result.outcome))
  const done = results.length - skipped.length
  const skips = skipped.map((result) => result.outcome as SkipOutcome)

  return {
    title:
      skipped.length === 0
        ? `${verb} ${done}`
        : `${verb} ${done}, skipped ${skipped.length} (${reasonsText(skips)})`,
    description: skipped.length === 0 ? undefined : skippedList(skipped),
    wrote: done > 0,
  }
}
