import { describe, expect, it } from 'vitest'

import { proposalItem } from '@/__tests__/inboxItemBuilders'
import { inboxMarkerDetail, inboxMarkerLabel } from '@/format/inboxMarkerText'

describe('proposal markers of an inconclusive proposal', () => {
  it('reads as could not determine on Triage rows and in the marker detail', () => {
    const item = proposalItem(1, { verdict: 'inconclusive', patchAction: null })

    expect(inboxMarkerLabel(item)).toBe('Proposed · Could not determine')
    expect(inboxMarkerDetail(item, new Date())).toBe(
      'Proposal waiting for review: Could not determine',
    )
  })
})
