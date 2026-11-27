import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ProposalFix } from '#core/proposal.ts'
import type { ProposalView } from '#core/proposalView.ts'
import { buildProposal, buildProposalDetail } from '@/__tests__/proposalDetailBuilders'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import ProposalHeader from '@/components/proposals/ProposalHeader.vue'

const FIX: ProposalFix = {
  action: 'upgrade libxslt to 1.1.43-r4 (rebuild on the current base)',
  layer: null,
  fixedVersion: '1.1.43-r4',
  change: null,
  effort: null,
}

let wrapper: VueWrapper | null = null

/**
 * Mounts the review header on a proposal.
 * @param {Partial<ProposalView>} overrides - Proposal fields to set
 * @returns {VueWrapper} - Wrapper
 */
const header = (overrides: Partial<ProposalView>): VueWrapper => {
  wrapper = mountWithProviders(ProposalHeader, {
    detail: buildProposalDetail({ proposal: buildProposal(overrides) }),
  })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllGlobals()
})

describe('ProposalHeader', () => {
  it('shows the verdict and confidence without the patch action, What to do holds it', () => {
    const claim = header({
      verdict: 'needs_patch',
      justification: null,
      fix: { ...FIX, layer: 'base_image' },
    }).get('.claim')

    expect(claim.get('.verdict-chip').text()).toBe('Needs patch')
    expect(claim.text()).toContain('Medium confidence')
    expect(claim.find('.patch-action').exists()).toBe(false)
  })

  it('labels an inconclusive proposal and its dismissal', () => {
    expect(
      header({ verdict: 'inconclusive', justification: null, missing: ['registry access'] })
        .get('.verdict-chip')
        .text(),
    ).toBe('Could not determine')
    wrapper?.unmount()

    const dismissed = header({
      verdict: 'inconclusive',
      justification: null,
      missing: ['registry access'],
      state: 'rejected',
      resolution: 'rejected',
      resolutionNote: 'Checked by hand',
      resolvedAt: '2026-11-26T12:00:00.000Z',
      resolvedBy: 'alice',
    })

    expect(dismissed.get('.state .chip').text()).toBe('Dismissed')
    expect(dismissed.get('.state').text()).toContain('Dismissed by alice')
  })

  it('names the client kind in the proposer line, an Auto-check and older proposals by label', () => {
    const proposerOf = (overrides: Partial<ProposalView>): string => {
      const text = header(overrides).get('.proposer').text()

      wrapper?.unmount()
      return text
    }

    expect(proposerOf({ clientKind: 'claude_app' })).toMatch(/^Proposed by dev via Claude app ·/)
    expect(proposerOf({ clientKind: 'auto_check', clientLabel: 'Auto-check #2' })).toMatch(
      /^Proposed by dev via Auto-check #2 ·/,
    )
    expect(proposerOf({ clientKind: null })).toMatch(
      /^Proposed by dev via Claude Code \(laptop\) ·/,
    )
  })
})
