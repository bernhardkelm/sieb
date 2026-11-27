import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import type { ProposalAcceptResponse, ProposalDetail } from '#core/proposalApiTypes.ts'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import {
  buildDecisionView,
  buildProposal,
  buildProposalDetail,
} from '@/__tests__/proposalDetailBuilders'
import { acceptProposal, fetchProposalDetail, rejectProposal } from '@/api/proposalsApi'
import ProposalReview from '@/components/proposals/ProposalReview.vue'
import { CHORD_ARM_DWELL_MS } from '@/composables/useChordArming'

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

const accepted: ProposalAcceptResponse = {
  proposal: buildProposal({ state: 'accepted', resolution: 'accepted' }),
  decisions: [buildDecisionView('not_affected')],
  supersededIds: [],
}
let wrapper: VueWrapper | null = null
let props: { proposalId: number; onResolved: () => void }

/**
 * Mounts the review panel on proposal 7, the API answers the detail of every requested id.
 * @returns {Promise<HTMLElement>} - Panel element
 */
const review = async (): Promise<HTMLElement> => {
  props = reactive({ proposalId: 7, onResolved: vi.fn<() => void>() })
  wrapper = mountWithProviders(ProposalReview, props)
  await flushPromises()
  return wrapper.get<HTMLElement>('.proposal-review').element
}

/**
 * Dispatches Cmd+Enter on the panel element of the page.
 * @param {boolean} repeat - Whether it is a key repeat of a held key
 * @returns {Promise<void>} - Resolves once settled
 */
const chord = async (repeat = false): Promise<void> => {
  document
    .querySelector('.proposal-review')!
    .dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, repeat, bubbles: true }),
    )
  await flushPromises()
}

/**
 * Moves the faked clock forward.
 * @param {number} ms - Milliseconds
 * @returns {void}
 */
const wait = (ms: number): void => {
  vi.setSystemTime(Date.now() + ms)
}

/**
 * Dispatches a key event on the panel element of the page.
 * @param {'keydown' | 'keyup'} type - Event type
 * @param {KeyboardEventInit} init - Key and modifiers
 * @returns {void}
 */
const keyOnPanel = (type: 'keydown' | 'keyup', init: KeyboardEventInit): void => {
  document
    .querySelector('.proposal-review')!
    .dispatchEvent(new KeyboardEvent(type, { bubbles: true, ...init }))
}

/**
 * Arms the chord deliberately: the dwell passes and an arrow key scrolls the panel.
 * @returns {void}
 */
const arm = (): void => {
  wait(CHORD_ARM_DWELL_MS)
  keyOnPanel('keydown', { key: 'ArrowDown' })
  keyOnPanel('keyup', { key: 'ArrowDown' })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.mocked(fetchProposalDetail)
    .mockReset()
    .mockImplementation((id) =>
      Promise.resolve(buildProposalDetail({ proposal: buildProposal({ id }) })),
    )
  vi.mocked(acceptProposal).mockReset().mockResolvedValue(accepted)
  vi.mocked(rejectProposal).mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('ProposalReview accept chord', () => {
  it('needs both the dwell and a deliberate interaction, never a single key', async () => {
    await review()

    wait(CHORD_ARM_DWELL_MS)
    await chord()
    expect(acceptProposal).not.toHaveBeenCalled()
    expect(document.querySelector('.arm-hint')).not.toBeNull()

    for (const key of ['ArrowDown', 'Enter', 'a', ' ']) {
      keyOnPanel('keydown', { key })
    }
    await flushPromises()
    expect(acceptProposal).not.toHaveBeenCalled()

    await chord()
    expect(acceptProposal).toHaveBeenCalledExactlyOnceWith(7, expect.anything())
  })

  it('does not arm before the dwell even after an interaction', async () => {
    const panel = await review()

    panel.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    wait(CHORD_ARM_DWELL_MS - 50)
    await chord()
    expect(acceptProposal).not.toHaveBeenCalled()

    wait(50)
    await chord()
    expect(acceptProposal).toHaveBeenCalledOnce()
  })

  it('never arms from the keys of a refused chord, Enter or keys with a modifier held', async () => {
    await review()

    await chord()
    keyOnPanel('keyup', { key: 'Enter', metaKey: true })
    keyOnPanel('keyup', { key: 'Meta' })
    for (const key of ['Enter', 'Meta', 'Control', 'Shift', 'Alt']) {
      keyOnPanel('keydown', { key })
      keyOnPanel('keyup', { key })
    }
    keyOnPanel('keydown', { key: 'j', metaKey: true })
    keyOnPanel('keydown', { key: 'x', shiftKey: true })
    keyOnPanel('keydown', { key: 'ArrowDown', repeat: true })
    wait(CHORD_ARM_DWELL_MS * 3)
    await chord()
    await chord()

    expect(acceptProposal).not.toHaveBeenCalled()
  })

  it('arms on a pointer press inside the panel, not outside it', async () => {
    const panel = await review()
    const outside = document.body.appendChild(document.createElement('button'))

    wait(CHORD_ARM_DWELL_MS)
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await chord()
    expect(acceptProposal).not.toHaveBeenCalled()

    panel.querySelector('.body')!.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await chord()
    expect(acceptProposal).toHaveBeenCalledOnce()
  })

  it('accepts at most once while the chord is held down', async () => {
    await review()
    arm()

    await chord()
    for (let repeat = 0; repeat < 10; repeat += 1) {
      wait(33)
      await chord(true)
    }

    expect(acceptProposal).toHaveBeenCalledOnce()
  })

  it('never accepts from key repeats of a chord held before the proposal showed', async () => {
    await review()

    for (let repeat = 0; repeat < 45; repeat += 1) {
      wait(33)
      await chord(true)
    }

    expect(acceptProposal).not.toHaveBeenCalled()
  })

  it('does not let presses carried over to the next proposal accept it', async () => {
    await review()
    arm()
    await chord()

    props.proposalId = 8
    await flushPromises()
    for (const gap of [150, 150, CHORD_ARM_DWELL_MS]) {
      wait(gap)
      await chord()
      keyOnPanel('keyup', { key: 'Meta' })
    }

    expect(acceptProposal).toHaveBeenCalledExactlyOnceWith(7, expect.anything())

    keyOnPanel('keydown', { key: 'ArrowDown' })
    await chord()
    expect(acceptProposal).toHaveBeenLastCalledWith(8, expect.anything())
  })

  it('submits the reject reason once while Cmd+Enter is held', async () => {
    vi.mocked(rejectProposal).mockResolvedValue({
      proposal: buildProposal({ state: 'rejected', resolution: 'rejected' }),
    })
    await review()
    ;[...document.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Reject')!
      .click()
    await flushPromises()

    const area = document.querySelector<HTMLTextAreaElement>('.reject-form textarea')!

    area.value = 'Wrong image.'
    area.dispatchEvent(new Event('input'))
    for (const repeat of [true, true, true]) {
      area.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, repeat, bubbles: true }),
      )
    }
    await flushPromises()
    expect(rejectProposal).not.toHaveBeenCalled()

    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }))
    await flushPromises()
    expect(rejectProposal).toHaveBeenCalledOnce()
  })
})
