import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountWithProviders } from '@/__tests__/mountWithProviders'
import CopyButton from '@/components/common/CopyButton.vue'
import { notifyError } from '@/toast/toastManager'

vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
}))

const PROPS = { value: 'CVE-2024-6387', label: 'Copy CVE ID' }

describe('CopyButton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(notifyError).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('writes the value to the clipboard and shows the check icon for a moment', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue()

    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const wrapper = mountWithProviders(CopyButton, PROPS)
    const button = wrapper.get('button')

    expect(button.attributes('aria-label')).toBe('Copy CVE ID')

    await button.trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('CVE-2024-6387')
    expect(button.get('[role="status"]').text()).toBe('Copied')
    expect(notifyError).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1500)
    await flushPromises()

    expect(button.get('[role="status"]').text()).toBe('')
    wrapper.unmount()
  })

  it('raises an error toast when the clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', {})

    const wrapper = mountWithProviders(CopyButton, PROPS)
    const button = wrapper.get('button')

    await button.trigger('click')
    await flushPromises()

    expect(notifyError).toHaveBeenCalledTimes(1)
    expect(button.get('[role="status"]').text()).toBe('')
    wrapper.unmount()
  })
})
