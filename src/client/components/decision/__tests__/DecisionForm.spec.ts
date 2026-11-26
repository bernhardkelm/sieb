import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/ApiError'
import DecisionForm from '@/components/decision/DecisionForm.vue'
import type { DecisionFormValue } from '@/components/decision/decisionFormModel'

const NOW = new Date(2026, 5, 1, 12, 0, 0)

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
  const option = wrapper.findAll('[role="radio"]').find((item) => item.text() === label)

  await option?.trigger('click')
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

describe('DecisionForm', () => {
  it('defaults the expiry per status', async () => {
    const wrapper = mountForm()
    const date = wrapper.get<HTMLInputElement>('input[type="date"]')
    const never = wrapper.get<HTMLInputElement>('input[type="checkbox"]')

    expect(never.element.checked).toBe(true)

    await pickStatus(wrapper, 'Accepted')
    expect(never.element.checked).toBe(false)
    expect(date.element.value).toBe('2026-08-30')

    await pickStatus(wrapper, 'Fix planned')
    expect(never.element.checked).toBe(true)
  })

  it('keeps an expiry the user picked when the status changes', async () => {
    const wrapper = mountForm()

    await pickStatus(wrapper, 'Accepted')
    await wrapper.get('input[type="date"]').setValue('2026-07-15')
    await pickStatus(wrapper, 'Not affected')

    expect(wrapper.get<HTMLInputElement>('input[type="date"]').element.value).toBe('2026-07-15')
  })

  it('submits the trimmed values with the expiry at the end of the picked day', async () => {
    const wrapper = mountForm({ imageLabel: 'nginx' })

    await pickStatus(wrapper, 'Accepted')
    await wrapper.get('textarea').setValue('  internal only  ')
    await wrapper
      .findAll('[role="radio"]')
      .find((item) => item.text() === 'All images')
      ?.trigger('click')
    await wrapper.get('form').trigger('submit')

    const [value] = wrapper.emitted<[DecisionFormValue]>('submit')?.[0] ?? []

    expect(value).toEqual({
      status: 'accepted',
      reason: 'internal only',
      scope: 'all',
      expiresAt: new Date(2026, 7, 30, 23, 59, 59).toISOString(),
      expiryTouched: false,
      reconfirm: false,
    })
  })

  it('submits null for never and on Ctrl+Enter', async () => {
    const wrapper = mountForm()

    await wrapper.get('textarea').setValue('vendored, not loaded')
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter', ctrlKey: true })

    expect(wrapper.emitted<[DecisionFormValue]>('submit')?.[0]?.[0]).toMatchObject({
      status: 'not_affected',
      expiresAt: null,
    })
  })

  it('refuses a blank reason without submitting', async () => {
    const wrapper = mountForm()

    await wrapper.get('textarea').setValue('   ')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('A reason is required.')
    expect(wrapper.get('textarea').attributes('aria-invalid')).toBe('true')
  })

  it('shows server validation errors per field and general ones below', () => {
    const error = new ApiError(
      400,
      {
        error: 'validation',
        errors: [
          { field: 'reason', code: 'required' },
          { field: 'expiresAt', code: 'in_past' },
          { field: 'imageRef', code: 'required' },
        ],
      },
      '/api/decisions',
    )
    const wrapper = mountForm({ error })

    expect(wrapper.text()).toContain('Required.')
    expect(wrapper.text()).toContain('Must lie in the future.')
    expect(wrapper.text()).toContain('imageRef: Required.')
    expect(wrapper.get('input[type="date"]').attributes('aria-invalid')).toBe('true')
  })

  it('shows a conflict as general error', () => {
    const error = new ApiError(409, { error: 'conflict', decisionId: 3 }, '/api/decisions')
    const wrapper = mountForm({ error })

    expect(wrapper.get('[role="alert"]').text()).toContain('exists already')
  })

  it('starts from an existing decision without a scope choice', () => {
    const wrapper = mountForm({
      scopeChoice: false,
      initial: { status: 'fix_planned', reason: 'next release', expiresAt: null },
    })

    expect(wrapper.get('textarea').element.value).toBe('next release')
    expect(wrapper.findAll('[role="radio"]').map((item) => item.text())).toEqual([
      'Not affected',
      'Accepted',
      'Fix planned',
    ])
    expect(wrapper.text()).toContain('does not silence alerts')
  })

  it('shows the given expiry for the starting status and the default for any other', async () => {
    const wrapper = mountForm({
      initial: { status: 'not_affected', reason: 'x', expiresAt: '2026-07-01T12:00:00.000Z' },
    })
    const date = wrapper.get<HTMLInputElement>('input[type="date"]')

    expect(date.element.value).toBe('2026-07-01')

    await pickStatus(wrapper, 'Accepted')
    expect(date.element.value).toBe('2026-08-30')

    await pickStatus(wrapper, 'Not affected')
    expect(date.element.value).toBe('2026-07-01')

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted<[DecisionFormValue]>('submit')?.[0]?.[0]).toMatchObject({
      expiryTouched: false,
    })
  })

  it('reports a draft as dirty once the reason or the expiry changed', async () => {
    const wrapper = mountForm({ initial: { reason: 'kept' } })

    expect(wrapper.emitted<[boolean]>('dirty')?.at(-1)).toEqual([false])

    await pickStatus(wrapper, 'Accepted')
    expect(wrapper.emitted<[boolean]>('dirty')?.at(-1)).toEqual([false])

    await wrapper.get('textarea').setValue('kept, and more')
    expect(wrapper.emitted<[boolean]>('dirty')?.at(-1)).toEqual([true])

    await wrapper.get('textarea').setValue('kept')
    expect(wrapper.emitted<[boolean]>('dirty')?.at(-1)).toEqual([false])

    await wrapper.get('input[type="date"]').setValue('2026-07-15')
    expect(wrapper.emitted<[boolean]>('dirty')?.at(-1)).toEqual([true])
  })

  it('clears a missing date error once a date is picked', async () => {
    const wrapper = mountForm()

    await wrapper.get('textarea').setValue('reason')
    await wrapper.get('input[name="never-expires"]').setValue(false)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Pick a date or choose never.')

    await wrapper.get('input[type="date"]').setValue('2026-07-15')
    expect(wrapper.text()).not.toContain('Pick a date or choose never.')
  })

  it('offers to re-confirm a re-opened decision and explains a plain save', async () => {
    const wrapper = mountForm({ reconfirmable: true, initial: { reason: 'kept' } })

    expect(wrapper.text()).toContain('keeps the decision re-opened')

    await wrapper.get('input[name="reconfirm"]').setValue(true)
    expect(wrapper.text()).toContain('silences the decision again')

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted<[DecisionFormValue]>('submit')?.[0]?.[0]).toMatchObject({
      reconfirm: true,
    })
  })

  it('caps the reason at the length the server accepts', () => {
    expect(mountForm().get('textarea').attributes('maxlength')).toBe('2000')
  })
})
