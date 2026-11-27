import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildDecision } from '#core/__tests__/coreBuilders.ts'
import DecisionForm from '@/components/decision/DecisionForm.vue'
import type { DecisionFormValue } from '@/components/decision/decisionFormModel'
import { decisionPatch } from '@/components/decision/decisionPatch'
import { acceptEdits, editInitial } from '@/components/proposals/acceptEdits'

const NOW = new Date(2026, 5, 1, 12, 0, 0)

const WAITING_FOR = 'k3s release bundling traefik 3.7.17'

/**
 * Mounts the form attached to the document.
 * @param {Record<string, unknown>} props - Form props
 * @returns {VueWrapper} - Mounted form
 */
const mountForm = (props: Record<string, unknown> = {}): VueWrapper =>
  mount(DecisionForm, { props, attachTo: document.body })

/**
 * Clicks the status option with a label.
 * @param {VueWrapper} wrapper - Mounted form
 * @param {string} label - Option label
 * @returns {Promise<void>} - Resolves after the update
 */
const pickStatus = async (wrapper: VueWrapper, label: string): Promise<void> => {
  await wrapper
    .findAll('[role="radio"]')
    .find((item) => item.text() === label)
    ?.trigger('click')
}

/**
 * Submits the form and returns the emitted value.
 * @param {VueWrapper} wrapper - Mounted form
 * @returns {Promise<DecisionFormValue | undefined>} - Value, undefined when the form stopped
 */
const submit = async (wrapper: VueWrapper): Promise<DecisionFormValue | undefined> => {
  await wrapper.get('form').trigger('submit')
  return wrapper.emitted<[DecisionFormValue]>('submit')?.at(-1)?.[0]
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('DecisionForm waiting for upstream', () => {
  it('offers the checkbox for fix_planned only', async () => {
    const wrapper = mountForm()

    await pickStatus(wrapper, 'Accepted')
    expect(wrapper.find('input[name="upstreamPending"]').exists()).toBe(false)
    await pickStatus(wrapper, 'Fix planned')
    expect(wrapper.find('input[name="upstreamPending"]').exists()).toBe(true)
  })

  it('needs what it waits for and a review date when checked', async () => {
    const wrapper = mountForm()

    await pickStatus(wrapper, 'Fix planned')
    await wrapper.get('textarea').setValue('wait for k3s')
    await wrapper.get('input[name="upstreamPending"]').setValue(true)

    expect(await submit(wrapper)).toBeUndefined()
    expect(wrapper.text()).toContain('Name what you wait for.')
    expect(wrapper.text()).toContain('Waiting for upstream needs a review date.')

    await wrapper.get('input[type="text"]').setValue(` ${WAITING_FOR} `)
    await wrapper.get('input[name="never-expires"]').setValue(false)
    await wrapper.get('input[type="date"]').setValue('2026-07-01')

    expect(await submit(wrapper)).toMatchObject({
      status: 'fix_planned',
      upstreamPending: true,
      waitingFor: WAITING_FOR,
      expiresAt: new Date(2026, 6, 1, 23, 59, 59).toISOString(),
    })
  })

  it('drops the upstream fields when the status changes away', async () => {
    const wrapper = mountForm({
      initial: {
        status: 'fix_planned',
        reason: 'wait for k3s',
        scope: 'image',
        expiresAt: '2026-07-01T21:59:59.000Z',
        upstreamPending: true,
        waitingFor: WAITING_FOR,
      },
    })

    expect(wrapper.get<HTMLInputElement>('input[name="upstreamPending"]').element.checked).toBe(
      true,
    )
    await pickStatus(wrapper, 'Accepted')
    expect(await submit(wrapper)).toMatchObject({
      status: 'accepted',
      upstreamPending: false,
      waitingFor: null,
    })
  })
})

describe('upstream fields in edits and patches', () => {
  const proposed = {
    status: 'fix_planned' as const,
    justification: null,
    reason: 'wait for k3s',
    expiresAt: '2026-07-01T21:59:59.000Z',
    upstreamPending: true,
    waitingFor: WAITING_FOR,
  }
  const value: DecisionFormValue = {
    ...proposed,
    scope: 'image',
    expiryTouched: false,
    reconfirm: false,
  }

  it('prefills Edit & accept and sends only changed upstream fields', () => {
    expect(editInitial(proposed)).toMatchObject({ upstreamPending: true, waitingFor: WAITING_FOR })
    expect(acceptEdits(proposed, value)).toEqual({})
    expect(acceptEdits(proposed, { ...value, waitingFor: 'k3s 1.34' })).toEqual({
      waitingFor: 'k3s 1.34',
    })
    expect(acceptEdits(proposed, { ...value, upstreamPending: false, waitingFor: null })).toEqual({
      upstreamPending: false,
    })
  })

  it('patches a stored decision with the changed upstream fields', () => {
    const decision = buildDecision({ ...proposed, scope: 'image' })

    expect(decisionPatch(decision, value, NOW)).toEqual({})
    expect(decisionPatch(decision, { ...value, waitingFor: 'k3s 1.34' }, NOW)).toEqual({
      waitingFor: 'k3s 1.34',
    })
    expect(
      decisionPatch(
        buildDecision({ status: 'fix_planned' }),
        { ...value, expiryTouched: true },
        NOW,
      ),
    ).toMatchObject({ upstreamPending: true, waitingFor: WAITING_FOR })
  })
})
