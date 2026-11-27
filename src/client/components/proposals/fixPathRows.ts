import type { ProposalView } from '#core/proposalView.ts'

/** Which Fix path rows a proposal shows besides the review */
export interface FixPathRows {
  fixedVersion: boolean
  change: boolean
  effort: boolean
}

/**
 * Decides which fix rows show: with a value always, empty only for needs_patch and fix_planned
 * so a missing part stays visible there.
 * @param {Pick<ProposalView, 'verdict' | 'fix'>} proposal - Verdict and fix path
 * @param {boolean} planShown - Whether What to do already shows the steps and effort
 * @returns {FixPathRows} - Visibility per row
 */
export const fixPathRows = (
  proposal: Pick<ProposalView, 'verdict' | 'fix'>,
  planShown: boolean,
): FixPathRows => {
  const strict = proposal.verdict === 'needs_patch' || proposal.verdict === 'fix_planned'

  return {
    fixedVersion: Boolean(proposal.fix?.fixedVersion) || strict,
    change: !planShown && Boolean(proposal.fix?.change),
    effort: !planShown && (Boolean(proposal.fix?.effort) || strict),
  }
}

/**
 * Returns the heading of the Fix path section, "Review" when only review fields remain.
 * @param {Pick<ProposalView, 'verdict' | 'fix'>} proposal - Verdict and fix path
 * @param {boolean} planShown - Whether What to do already shows the steps and effort
 * @returns {string} - Section heading
 */
export const fixPathTitle = (
  proposal: Pick<ProposalView, 'verdict' | 'fix'>,
  planShown: boolean,
): string =>
  Object.values(fixPathRows(proposal, planShown)).some(Boolean) ? 'Fix path and review' : 'Review'
