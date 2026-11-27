import { flushPromises, type VueWrapper } from '@vue/test-utils'
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
  it('shows the patch action under the verdict and copies its version', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue()

    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const claim = header({
      verdict: 'needs_patch',
      justification: null,
      fix: { ...FIX, layer: 'base_image' },
    }).get('.claim')
    const copy = claim.get('.patch-action button')

    expect(claim.get('.verdict-chip').text()).toBe('Needs patch')
    expect(claim.get('.patch-action .layer').text()).toBe('Base image')
    expect(claim.get('.patch-action .text').text()).toBe(FIX.action)
    expect(copy.attributes('aria-label')).toBe('Copy 1.1.43-r4')

    await copy.trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('1.1.43-r4')
  })

  it('shows an action without a version or digest without a copy button', () => {
    const fix = { ...FIX, action: 'no fixed version yet, watch the advisory', fixedVersion: null }
    const row = header({ verdict: 'fix_planned', justification: null, fix })

    expect(row.get('.patch-action').text()).toBe('no fixed version yet, watch the advisory')
    expect(row.find('.patch-action button').exists()).toBe(false)
    expect(row.find('.patch-action .layer').exists()).toBe(false)
  })

  it('shows no patch action for other verdicts or proposals stored without one', () => {
    expect(header({ fix: FIX }).find('.patch-action').exists()).toBe(false)
    wrapper?.unmount()
    expect(
      header({ verdict: 'needs_patch', justification: null, fix: { ...FIX, action: null } })
        .find('.patch-action')
        .exists(),
    ).toBe(false)
  })
})
