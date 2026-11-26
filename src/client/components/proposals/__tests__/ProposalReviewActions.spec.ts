import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProposalAcceptResponse, ProposalDetail } from '#core/apiTypes.ts'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import {
  buildDecisionView,
  buildProposal,
  buildProposalDetail,
  IMAGE,
} from '@/__tests__/proposalDetailBuilders'
import { ApiError } from '@/api/ApiError'
import { acceptProposal, fetchProposalDetail, rejectProposal } from '@/api/proposalsApi'
import ProposalReview from '@/components/proposals/ProposalReview.vue'
import { useDataVersionStore } from '@/stores/dataVersionStore'
import { notifySuccess } from '@/toast/toastManager'

vi.mock('@/api/proposalsApi', () => ({
  fetchProposalDetail: vi.fn<(id: number) => Promise<ProposalDetail>>(),
  fetchProposals: vi.fn<() => Promise<never[]>>(() => Promise.resolve([])),
  acceptProposal: vi.fn<typeof acceptProposal>(),
  rejectProposal: vi.fn<typeof rejectProposal>(),
}))
vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
  notifySuccess: vi.fn<(title: string, description?: string) => void>(),
}))

const SEEN = { imageRef: IMAGE, decisionId: 4, updatedAt: '2026-11-26T10:00:00.000Z' }
const detail = buildProposalDetail({
  currentDecisionIds: [SEEN],
})
const accepted: ProposalAcceptResponse = {
  proposal: buildProposal({ state: 'accepted', resolution: 'accepted' }),
  decisions: [buildDecisionView('not_affected')],
  supersededIds: [],
}
let wrapper: VueWrapper | null = null
let resolved = vi.fn<() => void>()
let closed = vi.fn<() => void>()

/**
 * Mounts the review panel on the detail.
 * @returns {Promise<HTMLElement>} - Panel element
 */
const review = async (): Promise<HTMLElement> => {
  resolved = vi.fn<() => void>()
  closed = vi.fn<() => void>()
  wrapper = mountWithProviders(ProposalReview, {
    proposalId: 7,
    onResolved: resolved,
    onClose: closed,
  })
  await flushPromises()
  return wrapper.get<HTMLElement>('.proposal-review').element
}

/**
 * Finds a button of the page by its text.
 * @param {string} text - Button text
 * @returns {HTMLButtonElement | undefined} - Button
 */
const buttonByText = (text: string): HTMLButtonElement | undefined =>
  [...document.body.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === text,
  )

/**
 * Clicks a button of the page by its text.
 * @param {string} text - Button text
 * @returns {Promise<void>}
 */
const click = async (text: string): Promise<void> => {
  buttonByText(text)!.click()
  await flushPromises()
}

/**
 * Types into a text area.
 * @param {HTMLTextAreaElement} area - Text area
 * @param {string} value - Text
 * @returns {Promise<void>}
 */
const type = async (area: HTMLTextAreaElement, value: string): Promise<void> => {
  area.value = value
  area.dispatchEvent(new Event('input'))
  await flushPromises()
}

beforeEach(() => {
  vi.mocked(fetchProposalDetail).mockReset().mockResolvedValue(detail)
  vi.mocked(acceptProposal).mockReset()
  vi.mocked(rejectProposal).mockReset()
  vi.mocked(notifySuccess).mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('ProposalReview actions', () => {
  it('accepts with the current decision ids, bumps the data version and reports resolved', async () => {
    vi.mocked(acceptProposal).mockResolvedValue(accepted)
    await review()
    const version = useDataVersionStore().version

    await click('Accept')

    expect(acceptProposal).toHaveBeenCalledWith(7, {
      expectedDecisionIds: [SEEN],
    })
    expect(useDataVersionStore().version).toBe(version + 1)
    expect(notifySuccess).toHaveBeenCalledWith(
      'Not affected: CVE-2025-1000',
      "Claude's proposal accepted for 1 image",
    )
    expect(resolved).toHaveBeenCalledOnce()
  })

  it('reloads on a decision conflict and asks for another review without accepting', async () => {
    vi.mocked(acceptProposal).mockRejectedValue(
      new ApiError(409, { error: 'proposal_conflict' }, '/api/proposals/7/accept'),
    )
    const panel = await review()

    vi.mocked(fetchProposalDetail).mockResolvedValue({ ...detail, outdated: true })
    await click('Accept')

    expect(fetchProposalDetail).toHaveBeenCalledTimes(2)
    expect(panel.querySelector('.conflict-notice')!.textContent).toContain(
      'The decisions changed while you reviewed this proposal.',
    )
    expect(panel.querySelector('.outdated')).not.toBeNull()
    expect(resolved).not.toHaveBeenCalled()
  })

  it('keeps the decision ids first seen and waits for Review again when a reload changes them', async () => {
    vi.mocked(acceptProposal).mockResolvedValue(accepted)
    const panel = await review()
    const changed = [{ imageRef: IMAGE, decisionId: 9, updatedAt: '2026-11-26T12:00:00.000Z' }]

    vi.mocked(fetchProposalDetail).mockResolvedValue({ ...detail, currentDecisionIds: changed })
    useDataVersionStore().bump()
    await flushPromises()

    expect(panel.querySelector('.conflict-notice')).not.toBeNull()
    expect(buttonByText('Accept')!.disabled).toBe(true)
    expect(buttonByText('Edit & accept')!.disabled).toBe(true)

    panel.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    panel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }),
    )
    await flushPromises()
    expect(acceptProposal).not.toHaveBeenCalled()

    await click('Review again')
    expect(panel.querySelector('.conflict-notice')).toBeNull()

    await click('Accept')
    expect(acceptProposal).toHaveBeenCalledExactlyOnceWith(7, { expectedDecisionIds: changed })
  })

  it('flags a conflict when the decision seen was edited in place, same id and newer version', async () => {
    vi.mocked(acceptProposal).mockResolvedValue(accepted)
    const panel = await review()
    const edited = [{ ...SEEN, updatedAt: '2026-11-26T11:00:00.000Z' }]

    vi.mocked(fetchProposalDetail).mockResolvedValue({ ...detail, currentDecisionIds: edited })
    useDataVersionStore().bump()
    await flushPromises()

    expect(panel.querySelector('.conflict-notice')).not.toBeNull()
    expect(buttonByText('Accept')!.disabled).toBe(true)

    await click('Review again')
    await click('Accept')
    expect(acceptProposal).toHaveBeenCalledExactlyOnceWith(7, { expectedDecisionIds: edited })
  })

  it('accepts with the ids first seen after a reload that changed nothing', async () => {
    vi.mocked(acceptProposal).mockResolvedValue(accepted)
    const panel = await review()

    vi.mocked(fetchProposalDetail).mockResolvedValue({
      ...detail,
      currentDecisionIds: [...detail.currentDecisionIds],
    })
    useDataVersionStore().bump()
    await flushPromises()

    expect(panel.querySelector('.conflict-notice')).toBeNull()
    await click('Accept')
    expect(acceptProposal).toHaveBeenCalledExactlyOnceWith(7, {
      expectedDecisionIds: [SEEN],
    })
  })

  it('refreshes and closes when the proposal was closed meanwhile', async () => {
    vi.mocked(acceptProposal).mockRejectedValue(
      new ApiError(409, { error: 'proposal_closed' }, '/api/proposals/7/accept'),
    )
    await review()

    await click('Accept')

    expect(closed).toHaveBeenCalledOnce()
    expect(resolved).not.toHaveBeenCalled()
    expect(fetchProposalDetail).toHaveBeenCalledTimes(2)
  })

  it('opens the decision form prefilled and accepts with the edited fields only', async () => {
    vi.mocked(acceptProposal).mockResolvedValue({
      ...accepted,
      proposal: buildProposal({ state: 'accepted', resolution: 'accepted_edited' }),
    })
    const panel = await review()

    await click('Edit & accept')

    const reason = panel.querySelector<HTMLTextAreaElement>('.decision-form textarea')!

    expect(reason.value).toBe(detail.decisionValues.reason)
    expect(panel.querySelector('.proposal-edit-form')!.textContent).toContain(
      'Scope and images stay as proposed',
    )
    expect(panel.textContent).not.toContain('All images')

    await type(reason, 'Checked by hand, parser unused.')
    await click('Accept with edits')

    expect(acceptProposal).toHaveBeenCalledWith(7, {
      expectedDecisionIds: [SEEN],
      edits: { reason: 'Checked by hand, parser unused.' },
    })
    expect(resolved).toHaveBeenCalledOnce()
  })

  it('shows server field errors of the edits next to the form field', async () => {
    vi.mocked(acceptProposal).mockRejectedValue(
      new ApiError(
        400,
        { error: 'validation', errors: [{ field: 'edits.reason', code: 'too_long' }] },
        '/api/proposals/7/accept',
      ),
    )
    const panel = await review()

    await click('Edit & accept')
    await click('Accept with edits')

    expect(panel.querySelector('.decision-form')!.textContent).toContain('At most 2000 characters.')
    expect(resolved).not.toHaveBeenCalled()
  })

  it('rejects only with a reason and reports resolved', async () => {
    vi.mocked(rejectProposal).mockResolvedValue({
      proposal: buildProposal({ state: 'rejected', resolution: 'rejected' }),
    })
    await review()

    await click('Reject')
    const form = document.body.querySelector<HTMLFormElement>('.reject-form')!

    form.dispatchEvent(new Event('submit'))
    await flushPromises()
    expect(form.textContent).toContain('Required.')
    expect(rejectProposal).not.toHaveBeenCalled()

    await type(form.querySelector('textarea')!, 'The upload endpoint calls the parser.')
    form.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(rejectProposal).toHaveBeenCalledWith(7, 'The upload endpoint calls the parser.')
    expect(resolved).toHaveBeenCalledOnce()
  })

  it('closes when a reject meets a closed proposal', async () => {
    vi.mocked(rejectProposal).mockRejectedValue(
      new ApiError(409, { error: 'proposal_closed' }, '/api/proposals/7/reject'),
    )
    await review()

    await click('Reject')
    const form = document.body.querySelector<HTMLFormElement>('.reject-form')!

    await type(form.querySelector('textarea')!, 'Wrong image.')
    form.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(closed).toHaveBeenCalledOnce()
    expect(document.body.querySelector('.reject-form')).toBeNull()
  })
})
