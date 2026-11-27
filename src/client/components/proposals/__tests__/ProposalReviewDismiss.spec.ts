import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProposalDetail } from '#core/proposalApiTypes.ts'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import { buildProposalDetail } from '@/__tests__/proposalDetailBuilders'
import { fetchProposalDetail } from '@/api/proposalsApi'
import ProposalReview from '@/components/proposals/ProposalReview.vue'

vi.mock('@/api/proposalsApi', () => ({
  fetchProposalDetail: vi.fn<(id: number) => Promise<ProposalDetail>>(),
  fetchProposals: vi.fn<() => Promise<never[]>>(() => Promise.resolve([])),
  acceptProposal: vi.fn<() => Promise<never>>(),
  rejectProposal: vi.fn<() => Promise<never>>(),
}))

let wrapper: VueWrapper | null = null
let closed = vi.fn<() => void>()

/**
 * Mounts the review panel next to a list row and a button outside of it.
 * @returns {Promise<HTMLElement>} - Panel element
 */
const review = async (): Promise<HTMLElement> => {
  document.body.innerHTML =
    '<div role="option" class="row">row</div><button type="button" class="outside">x</button>'
  closed = vi.fn<() => void>()
  wrapper = mountWithProviders(ProposalReview, { proposalId: 7, onClose: closed })
  await flushPromises()
  return wrapper.get<HTMLElement>('.proposal-review').element
}

/**
 * Presses the primary pointer button on an element.
 * @param {Element} target - Pressed element
 * @returns {Promise<void>} - Resolves once settled
 */
const press = async (target: Element): Promise<void> => {
  target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
  await flushPromises()
}

beforeEach(() => {
  vi.mocked(fetchProposalDetail).mockReset().mockResolvedValue(buildProposalDetail())
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('ProposalReview outside press', () => {
  it('closes on a press outside, not on the panel or a list row', async () => {
    const panel = await review()

    await press(panel.querySelector('.vuln-id')!)
    await press(document.querySelector('.row')!)
    expect(closed).not.toHaveBeenCalled()

    await press(document.querySelector('.outside')!)
    expect(closed).toHaveBeenCalledOnce()
  })

  it('keeps an edited decision form open, as Escape does', async () => {
    const panel = await review()
    const edit = [...panel.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Edit & accept',
    )!

    edit.click()
    await flushPromises()

    const reason = panel.querySelector<HTMLTextAreaElement>('.decision-form textarea')!

    reason.value = 'Checked by hand.'
    reason.dispatchEvent(new Event('input'))
    await flushPromises()
    await press(document.querySelector('.outside')!)

    expect(closed).not.toHaveBeenCalled()
  })
})
