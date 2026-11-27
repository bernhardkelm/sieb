import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEEP_LINK_UNLOAD_WINDOW_MS,
  isDeepLinkUnload,
  openDeepLink,
} from '@/router/deepLinkNavigation'

const assign = vi.fn<(url: string) => void>()

beforeEach(() => {
  vi.useFakeTimers()
  assign.mockReset()
  vi.stubGlobal('location', { ...window.location, assign })
})

afterEach(() => {
  vi.advanceTimersByTime(DEEP_LINK_UNLOAD_WINDOW_MS)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('deepLinkNavigation', () => {
  it('opens the link and marks unloads right after it as caused by the link', () => {
    expect(isDeepLinkUnload()).toBe(false)

    openDeepLink('claude://code/new?q=Triage')

    expect(assign).toHaveBeenCalledWith('claude://code/new?q=Triage')
    expect(isDeepLinkUnload()).toBe(true)

    vi.advanceTimersByTime(DEEP_LINK_UNLOAD_WINDOW_MS - 1)
    expect(isDeepLinkUnload()).toBe(true)

    vi.advanceTimersByTime(1)
    expect(isDeepLinkUnload()).toBe(false)
  })
})
