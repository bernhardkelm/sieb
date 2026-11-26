import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { useClipboardCopy } from '@/composables/useClipboardCopy'
import { notifyError } from '@/toast/toastManager'

vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
}))

describe('useClipboardCopy', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(notifyError).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('writes the text and flags the copy for 1.5 seconds', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue()

    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const { copied, copy } = useClipboardCopy()

    expect(await copy('first')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('first')
    expect(copied.value).toBe(true)

    vi.advanceTimersByTime(1000)
    await copy('second')
    vi.advanceTimersByTime(1000)
    expect(copied.value).toBe(true)

    vi.advanceTimersByTime(500)
    expect(copied.value).toBe(false)
  })

  it('raises an error toast and stays unflagged when the clipboard refuses', async () => {
    const failure = new Error('denied')

    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn<(text: string) => Promise<void>>().mockRejectedValue(failure) },
    })

    const { copied, copy } = useClipboardCopy()

    expect(await copy('text')).toBe(false)
    expect(copied.value).toBe(false)
    expect(notifyError).toHaveBeenCalledWith('Could not copy to the clipboard', failure)
  })

  it('stops the reset timer when its scope ends', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn<(text: string) => Promise<void>>().mockResolvedValue() },
    })

    const scope = effectScope()
    const clipboard = scope.run(() => useClipboardCopy())!

    await clipboard.copy('text')
    scope.stop()
    vi.advanceTimersByTime(1500)

    expect(clipboard.copied.value).toBe(true)
  })
})
