import { describe, expect, it } from 'vitest'

import type { BulkDecisionSkip } from '#core/apiTypes.ts'
import { bulkSkipSummary } from '@/components/decision/bulkSkipSummary'

/**
 * Builds a skipped image.
 * @param {BulkDecisionSkip['reason']} reason - Skip reason
 * @returns {BulkDecisionSkip} - Skip
 */
const skip = (reason: BulkDecisionSkip['reason']): BulkDecisionSkip => ({
  imageRef: 'index.docker.io/library/nginx',
  reason,
  decisionId: reason === 'unknown_finding' ? null : 1,
})

describe('bulkSkipSummary', () => {
  it('says nothing without skips', () => {
    expect(bulkSkipSummary([])).toBeUndefined()
  })

  it('breaks the skips down per reason', () => {
    expect(bulkSkipSummary([skip('decided'), skip('decided'), skip('unknown_finding')])).toBe(
      '3 images skipped: 2 already decided, 1 without open finding.',
    )
  })

  it('points expired and re-opened decisions to the Decisions view', () => {
    expect(bulkSkipSummary([skip('expired'), skip('reopened')])).toBe(
      '2 images skipped: 1 re-opened, 1 expired. Re-confirm or edit expired and re-opened decisions in the Decisions view.',
    )
  })
})
