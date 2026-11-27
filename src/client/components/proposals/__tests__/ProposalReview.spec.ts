import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProposalDetail } from '#core/apiTypes.ts'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import {
  buildDecisionView,
  buildImageFacts,
  buildProposal,
  buildProposalDetail,
  OWN_IMAGE,
} from '@/__tests__/proposalDetailBuilders'
import { fetchProposalDetail } from '@/api/proposalsApi'
import ProposalReview from '@/components/proposals/ProposalReview.vue'

vi.mock('@/api/proposalsApi', () => ({
  fetchProposalDetail: vi.fn<(id: number) => Promise<ProposalDetail>>(),
  fetchProposals: vi.fn<() => Promise<never[]>>(() => Promise.resolve([])),
  acceptProposal: vi.fn<() => Promise<never>>(),
  rejectProposal: vi.fn<() => Promise<never>>(),
}))

let wrapper: VueWrapper | null = null

/**
 * Mounts the review panel on a detail.
 * @param {ProposalDetail} detail - Detail the API answers
 * @returns {Promise<HTMLElement>} - Panel element
 */
const review = async (detail: ProposalDetail): Promise<HTMLElement> => {
  vi.mocked(fetchProposalDetail).mockResolvedValue(detail)
  wrapper = mountWithProviders(ProposalReview, { proposalId: detail.proposal.id })
  await flushPromises()
  return wrapper.get<HTMLElement>('.proposal-review').element
}

beforeEach(() => {
  vi.mocked(fetchProposalDetail).mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('ProposalReview', () => {
  it('shows a strong proposal with verdict, proposer, facts, claims and effects', async () => {
    const panel = await review(
      buildProposalDetail({
        proposal: buildProposal({
          confidence: 'high',
          evidenceBasis: ['image', 'upstream_source'],
          presence: 'libssl3 3.0.1 in /usr/lib',
          references: ['https://example.org/advisory', 'javascript:alert(1)'],
        }),
      }),
    )

    expect(panel.querySelector('.vuln-id')!.textContent).toBe('CVE-2025-1000')
    expect(panel.querySelector('.verdict-chip.lg')!.textContent).toBe(
      'Not affected · vulnerable code not in execute path',
    )
    expect(panel.querySelector('.confidence-chip')!.textContent).toContain('High confidence')
    expect(panel.querySelector('.proposer')!.textContent).toContain(
      'Proposed by dev via Claude Code (CLI)',
    )
    expect(panel.querySelectorAll('.badge.checked')).toHaveLength(2)
    expect(panel.querySelector('.evidence-basis [role="alert"]')).toBeNull()
    expect(panel.querySelector('.image-facts-row')!.textContent).toContain('3.0.1 → 3.0.2')
    expect(panel.querySelector('.sieb-facts')!.textContent).toContain('Undecided')
    expect(panel.querySelector('.claude-claims .tag')!.textContent).toBe('Claude says')
    expect(panel.querySelector('[data-claim="presence"]')!.textContent).toContain('libssl3 3.0.1')
    expect(panel.querySelector('[data-claim="reachability"]')!.textContent).toContain('Not stated')
    expect(panel.querySelector('.accept-effects')!.textContent).toContain(
      'Mutes alerts for 1 image',
    )
    expect(panel.querySelector('.outdated')).toBeNull()

    const links = [...panel.querySelectorAll<HTMLAnchorElement>('.reference-links a')]

    expect(links.map((link) => link.getAttribute('href'))).toEqual(['https://example.org/advisory'])
    expect(links[0]!.target).toBe('_blank')
    expect(links[0]!.rel).toBe('noopener noreferrer')
  })

  it('warns about advisory-only evidence and an uninspected private image', async () => {
    const panel = await review(
      buildProposalDetail({
        proposal: buildProposal({ evidenceBasis: ['advisory'], imageRefs: [OWN_IMAGE] }),
        images: [buildImageFacts({ imageRef: OWN_IMAGE, owner: 'self', sourceAccess: 'private' })],
      }),
    )
    const alerts = [...panel.querySelectorAll('.evidence-basis [role="alert"]')].map(
      (alert) => alert.textContent,
    )

    expect(alerts[0]).toContain('Weak evidence: only the advisory was checked')
    expect(alerts[1]).toContain('Claude could not inspect the source of a private image')
    expect(panel.querySelector('[data-access="private"]')!.textContent).toContain('Private source')
  })

  it('renders Claude text as plain text and highlights unknowns', async () => {
    const panel = await review(
      buildProposalDetail({
        proposal: buildProposal({
          summary: '<img src=x onerror=alert(1)> line one\nline two',
          unknowns: ['runtime flags'],
        }),
      }),
    )
    const summary = panel.querySelector('.summary .text')!

    expect(summary.querySelector('img')).toBeNull()
    expect(summary.textContent).toBe('<img src=x onerror=alert(1)> line one\nline two')
    expect(panel.querySelector('.unknowns-list')!.textContent).toContain('runtime flags')
  })

  it('marks an outdated proposal and names the decision it replaces', async () => {
    const panel = await review(
      buildProposalDetail({
        outdated: true,
        images: [buildImageFacts({ decision: buildDecisionView('fix_planned') })],
      }),
    )

    expect(panel.querySelector('.outdated')!.textContent).toContain('Outdated')
    expect(panel.querySelector('.accept-effects')!.textContent).toContain(
      'Replaces the current decision Fix planned → Not affected on image nginx',
    )
  })

  it('shows how a closed proposal ended, without actions or effects', async () => {
    const panel = await review(
      buildProposalDetail({
        proposal: buildProposal({
          state: 'rejected',
          resolution: 'rejected',
          resolutionNote: 'The parser is reachable.',
          resolvedBy: 'bob',
          resolvedAt: '2026-11-26T11:00:00.000Z',
        }),
      }),
    )

    expect(panel.querySelector('.state')!.textContent).toContain('Rejected by bob')
    expect(panel.querySelector('.note')!.textContent).toContain('The parser is reachable.')
    expect(panel.querySelector('.proposal-actions')).toBeNull()
    expect(panel.querySelector('.accept-effects')).toBeNull()
  })

  it('says when the proposal does not exist', async () => {
    const { ApiError } = await import('@/api/ApiError')

    vi.mocked(fetchProposalDetail).mockRejectedValue(new ApiError(404, { error: 'not_found' }, 'x'))
    wrapper = mountWithProviders(ProposalReview, { proposalId: 99 })
    await flushPromises()

    expect(wrapper.text()).toContain('This proposal does not exist.')
  })
})
