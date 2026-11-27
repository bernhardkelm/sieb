import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProposalAcceptResponse, ProposalDetail } from '#core/proposalApiTypes.ts'
import type { CheckCreateResponse, ChecksResponse } from '#core/check.ts'
import { buildCheck, buildChecksResponse } from '@/__tests__/checkBuilders'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import {
  buildDecisionView,
  buildImageFacts,
  buildInconclusiveDetail,
  buildProposal,
  IMAGE,
} from '@/__tests__/proposalDetailBuilders'
import { createChecks } from '@/api/checksApi'
import { acceptProposal, fetchProposalDetail, rejectProposal } from '@/api/proposalsApi'
import ProposalReview from '@/components/proposals/ProposalReview.vue'
import { useChecksStore } from '@/stores/checksStore'
import { notifySuccess } from '@/toast/toastManager'

vi.mock('@/api/proposalsApi', () => ({
  fetchProposalDetail: vi.fn<(id: number) => Promise<ProposalDetail>>(),
  fetchProposals: vi.fn<() => Promise<never[]>>(() => Promise.resolve([])),
  acceptProposal: vi.fn<typeof acceptProposal>(),
  rejectProposal: vi.fn<typeof rejectProposal>(),
}))
vi.mock('@/api/checksApi', () => ({
  fetchChecks: vi.fn<() => Promise<ChecksResponse>>(async () => buildChecksResponse()),
  createChecks: vi.fn<(ids: number[]) => Promise<CheckCreateResponse>>(),
  cancelCheck: vi.fn<(id: number) => Promise<void>>(),
}))
vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
  notifySuccess: vi.fn<(title: string, description?: string) => void>(),
  notifyNotice: vi.fn<(title: string, description?: string) => void>(),
}))

let wrapper: VueWrapper | null = null

/**
 * Mounts the review panel on an inconclusive proposal with a checks answer.
 * @param {ChecksResponse | null} checks - Checks answer, null before one arrived
 * @param {ProposalDetail} detail - Detail the API answers
 * @returns {Promise<HTMLElement>} - Panel element
 */
const review = async (
  checks: ChecksResponse | null = buildChecksResponse(),
  detail: ProposalDetail = buildInconclusiveDetail(),
): Promise<HTMLElement> => {
  vi.mocked(fetchProposalDetail).mockResolvedValue(detail)
  wrapper = mountWithProviders(ProposalReview, { proposalId: 7 })
  useChecksStore().response = checks
  await flushPromises()
  return wrapper.get<HTMLElement>('.proposal-review').element
}

/**
 * Returns the texts of the action buttons.
 * @param {HTMLElement} panel - Panel element
 * @returns {string[]} - Button texts
 */
const actionTexts = (panel: HTMLElement): string[] =>
  [...panel.querySelectorAll('.proposal-actions .buttons > *')].map(
    (button) => button.textContent?.trim() ?? '',
  )

/**
 * Finds a button of the page by its text.
 * @param {string} text - Button text
 * @returns {HTMLButtonElement} - Button
 */
const buttonByText = (text: string): HTMLButtonElement =>
  [...document.body.querySelectorAll('button')].find(
    (candidate) =>
      [...candidate.childNodes]
        .filter((node) => node.nodeType !== Node.COMMENT_NODE)
        .filter((node) => !(node instanceof HTMLElement && node.hidden))
        .map((node) => node.textContent)
        .join('')
        .trim() === text,
  )!

beforeEach(() => {
  vi.mocked(fetchProposalDetail).mockReset()
  vi.mocked(acceptProposal).mockReset()
  vi.mocked(rejectProposal).mockReset()
  vi.mocked(createChecks).mockReset()
  vi.mocked(notifySuccess).mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('ProposalReview of an inconclusive proposal', () => {
  it('offers Dismiss, Re-check and Decide myself, no Accept and no accept chord', async () => {
    const panel = await review()

    expect(actionTexts(panel)).toEqual(['Dismiss', 'Re-check', 'Decide myself'])
    expect(panel.querySelector('.proposal-actions .key-hint')).toBeNull()

    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }))
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }))
    await flushPromises()

    expect(acceptProposal).not.toHaveBeenCalled()
    expect(panel.querySelector('.arm-hint')).toBeNull()
  })

  it('queues an Auto-check of the target finding on Re-check', async () => {
    vi.mocked(createChecks).mockResolvedValue({
      queued: [buildCheck({ findingId: 1 })],
      skipped: [],
    })
    await review()

    buttonByText('Re-check').click()
    await flushPromises()

    expect(createChecks).toHaveBeenCalledWith([1])
  })

  it('blocks Re-check with the Auto-check reason while a check is open', async () => {
    await review(buildChecksResponse({ queued: [buildCheck({ findingId: 1, position: 3 })] }))
    const recheck = buttonByText('Re-check')

    expect(recheck.getAttribute('aria-disabled')).toBe('true')
    expect(recheck.title).toBe('A check of this finding is already queued at #3.')

    recheck.click()
    await flushPromises()
    expect(createChecks).not.toHaveBeenCalled()
  })

  it('offers the hand-off without Auto-check or for a private image', async () => {
    const off = await review(buildChecksResponse({ enabled: false }))

    expect(off.querySelector('.proposal-actions .handoff-button')).not.toBeNull()
    expect(actionTexts(off)).not.toContain('Re-check')
    wrapper?.unmount()

    const own = await review(
      buildChecksResponse(),
      buildInconclusiveDetail({}, [buildImageFacts({ sourceAccess: 'private' })]),
    )

    expect(own.querySelector('.proposal-actions .handoff-button')).not.toBeNull()
  })

  it('re-checks a private image a registry credential covers, as the side panel does', async () => {
    vi.mocked(createChecks).mockResolvedValue({
      queued: [buildCheck({ findingId: 1 })],
      skipped: [],
    })
    await review(
      buildChecksResponse(),
      buildInconclusiveDetail({}, [
        buildImageFacts({
          sourceAccess: 'private',
          checkAccess: {
            imageRef: IMAGE,
            level: 'credential',
            credentialId: 3,
            credentialLabel: 'Registry',
          },
        }),
      ]),
    )

    buttonByText('Re-check').click()
    await flushPromises()

    expect(createChecks).toHaveBeenCalledWith([1])
  })

  it('hands off a public image the server reports as unreachable', async () => {
    const panel = await review(
      buildChecksResponse(),
      buildInconclusiveDetail({}, [
        buildImageFacts({
          checkAccess: {
            imageRef: IMAGE,
            level: 'none',
            credentialId: null,
            credentialLabel: null,
          },
        }),
      ]),
    )

    expect(actionTexts(panel)).not.toContain('Re-check')
  })

  it('opens the decision form without a status and saves the reviewer decision', async () => {
    const accepted: ProposalAcceptResponse = {
      proposal: buildProposal({ state: 'accepted', resolution: 'accepted_edited' }),
      decisions: [buildDecisionView('accepted')],
      supersededIds: [],
    }
    vi.mocked(acceptProposal).mockResolvedValue(accepted)
    const panel = await review()

    buttonByText('Decide myself').click()
    await flushPromises()

    const form = panel.querySelector<HTMLElement>('.proposal-edit-form')!
    const reason = form.querySelector<HTMLTextAreaElement>('textarea')!

    expect(form.querySelector('[role="radio"][aria-checked="true"]')).toBeNull()
    expect(reason.value).toBe('')
    expect(form.textContent).toContain('dismiss the proposal to change them')

    const status = [...form.querySelectorAll<HTMLElement>('[role="radio"]')].find(
      (item) => item.textContent?.trim() === 'Accepted',
    )!

    status.click()
    reason.value = 'Risk accepted until the next release.'
    reason.dispatchEvent(new Event('input'))
    await flushPromises()
    buttonByText('Save decision').click()
    await flushPromises()

    expect(acceptProposal).toHaveBeenCalledWith(7, {
      expectedDecisionIds: [{ imageRef: IMAGE, decisionId: null, updatedAt: null }],
      edits: { status: 'accepted', reason: 'Risk accepted until the next release.' },
    })
    expect(notifySuccess).toHaveBeenCalledWith(
      'Accepted: CVE-2025-1000',
      'Your decision saved for 1 image',
    )
  })

  it('dismisses through the reject dialog with a reason', async () => {
    vi.mocked(rejectProposal).mockResolvedValue({
      proposal: buildProposal({ state: 'rejected', resolution: 'rejected' }),
    })
    await review()

    buttonByText('Dismiss').click()
    await flushPromises()

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!
    const reason = dialog.querySelector<HTMLTextAreaElement>('textarea')!

    expect(dialog.textContent).toContain('Dismiss the proposal for CVE-2025-1000?')
    reason.value = 'Checked by hand.'
    reason.dispatchEvent(new Event('input'))
    await flushPromises()
    dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
    await flushPromises()

    expect(rejectProposal).toHaveBeenCalledWith(7, 'Checked by hand.')
    expect(notifySuccess).toHaveBeenCalledWith(
      'Dismissed: CVE-2025-1000',
      'Claude sees your reason',
    )
  })
})
