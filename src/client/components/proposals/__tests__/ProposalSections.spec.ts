import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ProposalDetail } from '#core/proposalApiTypes.ts'
import type { ProposalFix } from '#core/proposal.ts'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import {
  buildInconclusiveDetail,
  buildProposal,
  buildProposalDetail,
} from '@/__tests__/proposalDetailBuilders'
import ProposalSections from '@/components/proposals/ProposalSections.vue'

const FIX: ProposalFix = {
  action: 'base image: rebuild on alpine:3.24.4 (libxslt 1.1.43-r4)',
  layer: 'base_image',
  fixedVersion: '1.1.43-r4',
  change: '1. Bump FROM to alpine:3.24.4\n2. Rebuild and deploy',
  effort: 'rebuild and deploy, about 15 minutes',
  availability: null,
  waitingFor: null,
  interim: null,
}

const REVIEW = { date: '2026-12-15T23:59:59.999Z', why: 'next base image release' }

let wrapper: VueWrapper | null = null

/**
 * Mounts the review sections on a detail.
 * @param {ProposalDetail} detail - Proposal detail
 * @returns {HTMLElement} - Sections element
 */
const sections = (detail: ProposalDetail): HTMLElement => {
  wrapper = mountWithProviders(ProposalSections, { detail })
  return wrapper.get<HTMLElement>('.proposal-sections').element
}

/**
 * Returns the section titles in reading order.
 * @param {HTMLElement} root - Sections element
 * @returns {string[]} - Titles without counts
 */
const titles = (root: HTMLElement): string[] =>
  [...root.querySelectorAll('section > h3')].map(
    (title) =>
      [...title.childNodes].find((node) => node.textContent?.trim())?.textContent?.trim() ?? '',
  )

/**
 * Returns the term labels of a definition list.
 * @param {Element | null} list - Definition list
 * @returns {string[]} - Terms
 */
const terms = (list: Element | null): string[] =>
  [...(list?.querySelectorAll('dt') ?? [])].map((term) => term.textContent?.trim() ?? '')

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllGlobals()
})

describe('ProposalSections', () => {
  it('puts What to do under the summary: action, steps, then effort and review by', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue()

    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const root = sections(
      buildProposalDetail({
        proposal: buildProposal({
          verdict: 'needs_patch',
          justification: null,
          fix: FIX,
          review: REVIEW,
        }),
      }),
    )
    const todo = root.querySelector('.what-to-do')!
    const parts = [...todo.children].map((child) => child.className.split(' ')[0])
    const copy = todo.querySelector<HTMLButtonElement>('.patch-action button')!

    expect(titles(root).slice(0, 3)).toEqual(['Summary', 'What to do', 'Evidence basis'])
    expect(parts).toEqual(['patch-action', 'claude-text', 'plan'])
    expect(todo.querySelector('.patch-action .layer')!.textContent).toBe('Base image')
    expect(todo.querySelector('.patch-action .text')!.textContent).toBe(FIX.action)
    expect(todo.querySelector('.steps')!.textContent).toContain('Bump FROM to alpine:3.24.4')
    expect(terms(todo.querySelector('.plan'))).toEqual(['Effort', 'Review by'])
    expect(todo.querySelector('.plan')!.textContent).toContain('about 15 minutes')
    expect(copy.getAttribute('aria-label')).toBe('Copy alpine:3.24.4')

    copy.click()
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('alpine:3.24.4')
  })

  it('keeps only the fixed version and review reason in Fix path, nothing twice', () => {
    const root = sections(
      buildProposalDetail({
        proposal: buildProposal({
          verdict: 'needs_patch',
          justification: null,
          fix: FIX,
          review: REVIEW,
        }),
      }),
    )
    const fix = root.querySelector('.fix-and-review')

    expect(terms(fix)).toEqual(['Fixed version', 'Review reason'])
    expect(fix!.textContent).toContain('next base image release')
    expect(root.querySelectorAll('.patch-action')).toHaveLength(1)
    expect(root.textContent!.match(/Bump FROM/gu)).toHaveLength(1)
    expect(root.textContent!.match(/about 15 minutes/gu)).toHaveLength(1)
  })

  it('shows steps without an action and skips the section without either', () => {
    const steps = sections(
      buildProposalDetail({
        proposal: buildProposal({ fix: { ...FIX, action: null, layer: null } }),
      }),
    )

    expect(steps.querySelector('.what-to-do .patch-action')).toBeNull()
    expect(steps.querySelector('.what-to-do .steps')).not.toBeNull()
    wrapper?.unmount()

    const none = sections(
      buildProposalDetail({
        proposal: buildProposal({ fix: { ...FIX, action: null, change: null }, review: REVIEW }),
      }),
    )

    expect(titles(none)).not.toContain('What to do')
    expect(terms(none.querySelector('.fix-and-review'))).toEqual([
      'Fixed version',
      'Effort',
      'Review by',
    ])
  })

  it('hides empty fix rows for not_affected, accepted and inconclusive, titled Review', () => {
    for (const verdict of ['not_affected', 'accepted'] as const) {
      const root = sections(
        buildProposalDetail({
          proposal: buildProposal({
            verdict,
            fix: { ...FIX, action: null, fixedVersion: null, change: null, effort: null },
            review: REVIEW,
          }),
        }),
      )

      expect(terms(root.querySelector('.fix-and-review'))).toEqual(['Review by'])
      expect(titles(root)).toContain('Review')
      expect(titles(root)).not.toContain('Fix path and review')
      wrapper?.unmount()
    }

    const inconclusive = sections(buildInconclusiveDetail({ fix: null }))

    expect(terms(inconclusive.querySelector('.fix-and-review'))).toEqual(['Review by'])
  })

  it('keeps Not stated for needs_patch and fix_planned', () => {
    for (const verdict of ['needs_patch', 'fix_planned'] as const) {
      const root = sections(
        buildProposalDetail({
          proposal: buildProposal({
            verdict,
            fix: { ...FIX, action: null, fixedVersion: null, change: null, effort: null },
            review: REVIEW,
          }),
        }),
      )

      expect(terms(root.querySelector('.fix-and-review'))).toEqual([
        'Fixed version',
        'Effort',
        'Review by',
      ])
      expect(titles(root)).toContain('Fix path and review')
      wrapper?.unmount()
    }
  })

  it('lists what is missing under the summary for inconclusive, without accept effects', () => {
    const root = sections(buildInconclusiveDetail({ fix: FIX }))

    expect(titles(root).slice(0, 3)).toEqual(['Summary', 'Missing to decide', 'Evidence basis'])
    expect(titles(root)).not.toContain('What to do')
    expect(titles(root)).not.toContain('What accepting will do')
    expect([...root.querySelectorAll('.missing-list li')].map((li) => li.textContent)).toEqual([
      'pull access to registry.example.com/app',
      'advisory text not reachable',
    ])
    expect(root.querySelector('.verdict-chip.lg')!.textContent).toBe('Could not determine')
    expect(root.querySelector('.patch-action')).toBeNull()
  })
})
