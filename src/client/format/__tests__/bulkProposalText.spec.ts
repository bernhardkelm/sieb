import { describe, expect, it } from 'vitest'

import type { BulkProposalOutcome, BulkProposalResult } from '#core/proposalBulk.ts'
import { bulkResultText } from '@/format/bulkProposalText'

/**
 * Builds results with one outcome each.
 * @param {BulkProposalOutcome[]} outcomes - Outcomes in order
 * @returns {BulkProposalResult[]} - Results with ids and CVEs from 1
 */
const results = (...outcomes: BulkProposalOutcome[]): BulkProposalResult[] =>
  outcomes.map((outcome, index) => ({ id: index + 1, vulnId: `CVE-2025-${index + 1}`, outcome }))

describe('bulkResultText', () => {
  it('counts the written proposals without a description when nothing was skipped', () => {
    expect(bulkResultText('Rejected', results('rejected', 'rejected', 'rejected'))).toEqual({
      title: 'Rejected 3',
      description: undefined,
      wrote: true,
    })
  })

  it('names a single skip reason and lists the skipped proposals', () => {
    expect(
      bulkResultText(
        'Accepted',
        results('accepted', 'accepted', 'outdated', 'accepted', 'accepted'),
      ),
    ).toEqual({
      title: 'Accepted 4, skipped 1 (outdated)',
      description: 'CVE-2025-3 outdated',
      wrote: true,
    })
  })

  it('counts mixed reasons and shortens a long list', () => {
    const text = bulkResultText('Accepted', [
      ...results('outdated', 'inconclusive', 'not_open', 'outdated', 'not_found', 'outdated'),
      { id: 99, vulnId: null, outcome: 'not_acceptable' },
    ])

    expect(text).toEqual({
      title:
        'Accepted 0, skipped 7 (3 outdated, 1 inconclusive, 1 already closed, 1 not found, 1 not acceptable)',
      description:
        'CVE-2025-1 outdated, CVE-2025-2 inconclusive, CVE-2025-3 already closed, CVE-2025-4 outdated, CVE-2025-5 not found and 2 more',
      wrote: false,
    })
  })
})
