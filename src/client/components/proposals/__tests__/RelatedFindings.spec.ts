import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type Component } from 'vue'

import type { ProposalDetail, ProposalRelatedFacts } from '#core/apiTypes.ts'
import { buildDecision } from '#core/__tests__/coreBuilders.ts'
import type { CheckCreateResponse, ChecksResponse } from '#core/check.ts'
import { buildCheck, buildChecksResponse } from '@/__tests__/checkBuilders'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import {
  buildInconclusiveDetail,
  buildProposal,
  buildProposalDetail,
} from '@/__tests__/proposalDetailBuilders'
import { createChecks } from '@/api/checksApi'
import ProposalSections from '@/components/proposals/ProposalSections.vue'
import RelatedFindings from '@/components/proposals/RelatedFindings.vue'
import { useChecksStore } from '@/stores/checksStore'

vi.mock('@/api/checksApi', () => ({
  fetchChecks: vi.fn<() => Promise<ChecksResponse>>(() => new Promise(() => {})),
  createChecks: vi.fn<(ids: number[]) => Promise<CheckCreateResponse>>(),
  cancelCheck: vi.fn<(id: number) => Promise<void>>(),
}))
vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
  notifySuccess: vi.fn<(title: string, description?: string) => void>(),
  notifyNotice: vi.fn<(title: string, description?: string) => void>(),
}))

const COREDNS = 'index.docker.io/rancher/mirrored-coredns-coredns'
const PSEUDO = 'v0.0.0-20260101000000-abcdef123456'
const REASON = 'The coredns module is a pseudo-version Trivy sorts below every release.'

/**
 * Builds sieb's facts on an open, undecided related finding on the coredns image.
 * @param {Partial<ProposalRelatedFacts>} overrides - Fields to set
 * @returns {ProposalRelatedFacts} - Facts
 */
const facts = (overrides: Partial<ProposalRelatedFacts> = {}): ProposalRelatedFacts => ({
  findingId: 21,
  note: null,
  vulnId: 'CVE-2099-00002',
  imageRef: COREDNS,
  open: true,
  sourceAccess: 'public',
  versions: [
    { package: 'github.com/coredns/coredns', installedVersion: PSEUDO, fixedVersion: null },
  ],
  decision: null,
  effective: null,
  ...overrides,
})

const RELATED: ProposalRelatedFacts[] = [
  facts({ note: 'same module, same pseudo-version' }),
  facts({ findingId: 22, vulnId: 'CVE-2099-00003' }),
  facts({
    findingId: 23,
    vulnId: 'CVE-2099-00005',
    decision: buildDecision({ id: 40, vulnId: 'CVE-2099-00005', status: 'not_affected' }),
    effective: { state: 'active' },
  }),
  facts({ findingId: 24, vulnId: 'CVE-2099-00006', open: false }),
  facts({ findingId: 25, vulnId: null, imageRef: null, sourceAccess: null, versions: [] }),
]

/**
 * Builds the review detail of a proposal with the related findings above.
 * @param {Partial<ProposalDetail>} overrides - Detail fields to set
 * @returns {ProposalDetail} - Detail
 */
const detailWithRelated = (overrides: Partial<ProposalDetail> = {}): ProposalDetail =>
  buildProposalDetail({
    proposal: buildProposal({
      relatedFindings: RELATED.map(({ findingId, note }) => ({ findingId, note })),
      relatedReason: REASON,
    }),
    related: RELATED,
    ...overrides,
  })

let mounted: RoutedMount | null = null

/**
 * Mounts a component with a detail on the Inbox review route, Auto-check on.
 * @param {Component} component - RelatedFindings or ProposalSections
 * @param {ProposalDetail} detail - Proposal detail
 * @param {ChecksResponse} checks - Checks answer
 * @returns {Promise<HTMLElement>} - Root element of the component
 */
const mountOn = async (
  component: Component,
  detail: ProposalDetail,
  checks: ChecksResponse = buildChecksResponse(),
): Promise<HTMLElement> => {
  const host = defineComponent({ setup: () => () => h(component, { detail }) })

  mounted = await mountWithRouter(host, '/inboxProposal?state=open')
  useChecksStore().response = checks
  await flushPromises()
  return mounted.wrapper.element as HTMLElement
}

/**
 * Returns the visible label of a button, without its hidden block reason.
 * @param {Element | null} button - Button
 * @returns {string} - Text of the button outside hidden elements
 */
const label = (button: Element | null): string => {
  const copy = button?.cloneNode(true) as Element | undefined

  copy?.querySelectorAll('[hidden]').forEach((hidden) => hidden.remove())
  return copy?.textContent?.trim() ?? ''
}

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  vi.mocked(createChecks).mockReset()
  document.body.innerHTML = ''
})

describe('RelatedFindings', () => {
  it('lists each related finding with its versions, state, note and a link to it', async () => {
    const root = await mountOn(RelatedFindings, detailWithRelated())
    const rows = [...root.querySelectorAll('.related-finding-row')]
    const link = rows[0]?.querySelector('a')

    expect(root.querySelector('.section-title')?.textContent).toBe('Same cause, 5 more findings')
    expect(root.querySelector('.claim-box')?.textContent).toContain(REASON)
    expect(rows).toHaveLength(5)
    expect(rows[0]?.textContent).toContain('CVE-2099-00002')
    expect(rows[0]?.textContent).toContain(`github.com/coredns/coredns ${PSEUDO}`)
    expect(rows[0]?.textContent).toContain('Undecided')
    expect(rows[0]?.querySelector('.note')?.textContent).toBe('same module, same pseudo-version')
    expect(link?.getAttribute('href')).toBe('/inboxProposal?state=open&finding=21')
    expect(rows[2]?.querySelector('.state')?.textContent).toContain('Not affected')
    expect(rows[3]?.textContent).toContain('resolved')
    expect(rows[4]?.textContent).toContain('Finding #25, no longer in sieb')
  })

  it('opens the bulk decision prefilled for the open, undecided findings only', async () => {
    const root = await mountOn(RelatedFindings, detailWithRelated())
    const decide = root.querySelector<HTMLButtonElement>('.decide')

    expect(label(decide)).toBe('Decide 2 the same way')
    expect(decide?.getAttribute('title')).toBe(
      '2 of 5 selected. Decided and resolved findings are skipped.',
    )

    decide?.click()
    await flushPromises()

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      '2 selected findings of CVE-2099-00002, CVE-2099-00003, one decision per image.',
    )
    expect(document.querySelector('[role="radio"][aria-checked="true"]')?.textContent?.trim()).toBe(
      'Not affected',
    )
    expect(document.querySelector('textarea')?.value).toBe(`Same cause as proposal #7: ${REASON}`)
  })

  it('falls back to the summary as the cited reason and blocks deciding without a verdict', async () => {
    const root = await mountOn(
      RelatedFindings,
      detailWithRelated({
        proposal: buildProposal({ relatedFindings: [{ findingId: 21, note: null }] }),
      }),
    )

    root.querySelector<HTMLButtonElement>('.decide')?.click()
    await flushPromises()

    expect(document.querySelector('textarea')?.value).toBe(
      'Same cause as proposal #7: The vulnerable parser is never called.',
    )

    mounted?.wrapper.unmount()
    const inconclusive = buildInconclusiveDetail()
    const blocked = await mountOn(RelatedFindings, { ...inconclusive, related: RELATED })

    expect(blocked.querySelector('.decide')?.getAttribute('aria-disabled')).toBe('true')
  })

  it('queues Auto-checks of the open, undecided findings without an open check', async () => {
    vi.mocked(createChecks).mockResolvedValue({
      queued: [buildCheck({ id: 10, findingId: 21 })],
      skipped: [],
    })
    const root = await mountOn(
      RelatedFindings,
      detailWithRelated(),
      buildChecksResponse({ queued: [buildCheck({ id: 9, findingId: 22 })] }),
    )
    const check = root.querySelector<HTMLButtonElement>('.auto-check')

    expect(label(check)).toBe('Auto-check 1')
    expect(check?.getAttribute('title')).toBe(
      '1 of 5 selected. Decided and resolved findings are skipped. Findings with an open check are skipped.',
    )

    check?.click()
    await flushPromises()

    expect(createChecks).toHaveBeenCalledWith([21])
  })

  it('blocks both actions once every related finding is decided or resolved', async () => {
    const root = await mountOn(RelatedFindings, detailWithRelated({ related: RELATED.slice(2) }))

    for (const selector of ['.decide', '.auto-check']) {
      expect(root.querySelector(selector)?.getAttribute('aria-disabled')).toBe('true')
      expect(root.querySelector(selector)?.getAttribute('title')).toBe(
        'Every finding of the same cause is decided or resolved.',
      )
    }

    mounted?.wrapper.unmount()
    const off = await mountOn(
      RelatedFindings,
      detailWithRelated(),
      buildChecksResponse({ enabled: false }),
    )

    expect(off.querySelector('.auto-check')).toBeNull()
  })
})

describe('ProposalSections with related findings', () => {
  /**
   * Returns the section titles in reading order.
   * @param {HTMLElement} root - Sections element
   * @returns {string[]} - Titles without counts
   */
  const titles = (root: HTMLElement): string[] =>
    [...root.querySelectorAll('.section-title')].map(
      (title) => title.childNodes[0]?.textContent?.trim() ?? '',
    )

  it('places the section under What to do, else under the evidence', async () => {
    const withPlan = detailWithRelated({
      proposal: buildProposal({
        verdict: 'needs_patch',
        justification: null,
        fix: {
          action: 'platform: upgrade k3s',
          layer: 'platform',
          fixedVersion: null,
          change: null,
          effort: null,
          availability: 'available',
          waitingFor: null,
          interim: null,
        },
        relatedReason: REASON,
      }),
    })
    const planned = titles(await mountOn(ProposalSections, withPlan))

    expect(planned.indexOf('Same cause, 5 more findings')).toBe(planned.indexOf('What to do') + 1)

    mounted?.wrapper.unmount()
    const plain = titles(await mountOn(ProposalSections, detailWithRelated()))

    expect(plain.indexOf('Same cause, 5 more findings')).toBe(plain.indexOf('Evidence') + 1)

    mounted?.wrapper.unmount()
    expect(titles(await mountOn(ProposalSections, buildProposalDetail()))).not.toContain(
      'Same cause, 5 more findings',
    )
  })
})
