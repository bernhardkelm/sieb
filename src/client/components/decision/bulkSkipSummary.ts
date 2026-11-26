import type { BulkDecisionSkip, BulkSkipReason } from '#core/apiTypes.ts'

const SKIP_LABELS: Record<BulkSkipReason, string> = {
  decided: 'already decided',
  expired: 'expired',
  reopened: 're-opened',
  unknown_finding: 'without open finding',
}

const ORDER: BulkSkipReason[] = ['decided', 'reopened', 'expired', 'unknown_finding']

/**
 * Summarises the images a bulk decision skipped per reason, with a hint where expired and
 * re-opened decisions are dealt with, since a bulk decision never overrides them.
 * @param {readonly BulkDecisionSkip[]} skipped - Skipped images
 * @returns {string | undefined} - Such as "3 images skipped: 2 already decided, 1 expired", undefined without skips
 */
export const bulkSkipSummary = (skipped: readonly BulkDecisionSkip[]): string | undefined => {
  if (skipped.length === 0) {
    return undefined
  }

  const counts = new Map<BulkSkipReason, number>()

  for (const skip of skipped) {
    counts.set(skip.reason, (counts.get(skip.reason) ?? 0) + 1)
  }

  const parts = ORDER.filter((reason) => counts.has(reason)).map(
    (reason) => `${counts.get(reason)} ${SKIP_LABELS[reason]}`,
  )
  const noun = skipped.length === 1 ? 'image' : 'images'
  const summary = `${skipped.length} ${noun} skipped: ${parts.join(', ')}.`

  return counts.has('expired') || counts.has('reopened')
    ? `${summary} Re-confirm or edit expired and re-opened decisions in the Decisions view.`
    : summary
}
