import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, type EffectScope } from 'vue'

import type { McpInfoResponse } from '#core/mcpApiTypes.ts'
import { fetchMcpInfo } from '@/api/tokensApi'
import { useMcpFocusRefresh } from '@/composables/useMcpFocusRefresh'
import { REFRESH_THROTTLE_MS, useMcpStore } from '@/stores/mcpStore'

vi.mock('@/api/tokensApi', () => ({
  fetchMcpInfo: vi.fn<typeof fetchMcpInfo>(),
}))

const ENABLED: McpInfoResponse = {
  enabled: true,
  mcpUrl: null,
  oauth: true,
  claude: { connected: false, activeTokens: 0, oauthLastSeenAt: null },
}

let visibility: DocumentVisibilityState = 'visible'
let scope: EffectScope | null = null

/**
 * Loads the store with an answer and listens in a fresh effect scope.
 * @param {McpInfoResponse} first - Answer of the first load
 * @returns {Promise<void>} - Resolves once loaded
 */
const listen = async (first: McpInfoResponse): Promise<void> => {
  vi.mocked(fetchMcpInfo).mockResolvedValue(first)
  await useMcpStore().load()
  scope = effectScope()
  scope.run(() => useMcpFocusRefresh())
}

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  vi.mocked(fetchMcpInfo).mockReset()
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
})

afterEach(() => {
  scope?.stop()
  scope = null
  vi.useRealTimers()
})

describe('useMcpFocusRefresh', () => {
  it('refreshes on focus and on a visible tab, at most once per throttle interval', async () => {
    await listen(ENABLED)

    window.dispatchEvent(new Event('focus'))
    expect(fetchMcpInfo).toHaveBeenCalledOnce()

    vi.advanceTimersByTime(REFRESH_THROTTLE_MS)
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(fetchMcpInfo).toHaveBeenCalledTimes(2)

    vi.mocked(fetchMcpInfo).mockResolvedValue({
      ...ENABLED,
      claude: { connected: true, activeTokens: 0, oauthLastSeenAt: '2026-11-20T10:00:00.000Z' },
    })
    vi.advanceTimersByTime(REFRESH_THROTTLE_MS)
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchMcpInfo).toHaveBeenCalledTimes(3)
    expect(useMcpStore().connected).toBe(true)
    expect(useMcpStore().info?.claude?.oauthLastSeenAt).toBe('2026-11-20T10:00:00.000Z')
  })

  it('skips hidden tabs, a disabled integration and stops listening with its scope', async () => {
    await listen(ENABLED)
    vi.advanceTimersByTime(REFRESH_THROTTLE_MS)

    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(fetchMcpInfo).toHaveBeenCalledOnce()

    visibility = 'visible'
    scope?.stop()
    window.dispatchEvent(new Event('focus'))
    expect(fetchMcpInfo).toHaveBeenCalledOnce()

    setActivePinia(createPinia())
    await listen({ enabled: false, mcpUrl: null, oauth: false, claude: null })
    vi.advanceTimersByTime(REFRESH_THROTTLE_MS)
    window.dispatchEvent(new Event('focus'))
    expect(fetchMcpInfo).toHaveBeenCalledTimes(2)
  })
})
