import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'

import type { McpInfoResponse } from '#core/mcpApiTypes.ts'
import { fetchMcpInfo } from '@/api/tokensApi'
import { useConnectionPoll } from '@/composables/useConnectionPoll'
import { CONNECT_POLL_MS, useMcpStore } from '@/stores/mcpStore'

vi.mock('@/api/tokensApi', () => ({
  fetchMcpInfo: vi.fn<typeof fetchMcpInfo>(),
}))

/**
 * Builds an MCP info answer of an enabled integration.
 * @param {boolean} connected - Whether Claude reaches sieb
 * @returns {McpInfoResponse} - Answer
 */
const answer = (connected: boolean): McpInfoResponse => ({
  enabled: true,
  mcpUrl: null,
  oauth: true,
  claude: { connected, activeTokens: 0, oauthLastSeenAt: null },
})

const waiting = ref(true)
let scope: EffectScope | null = null

/**
 * Loads the store with an answer and starts polling in a fresh effect scope.
 * @param {McpInfoResponse} first - Answer of the first load
 * @returns {Promise<void>} - Resolves once loaded
 */
const startPolling = async (first: McpInfoResponse): Promise<void> => {
  vi.mocked(fetchMcpInfo).mockResolvedValue(first)
  await useMcpStore().load()
  scope = effectScope()
  scope.run(() => useConnectionPoll(() => waiting.value))
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  vi.mocked(fetchMcpInfo).mockReset()
  waiting.value = true
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
})

afterEach(() => {
  scope?.stop()
  scope = null
  vi.useRealTimers()
})

describe('useConnectionPoll', () => {
  it('polls slowly while not connected and stops once Claude is connected', async () => {
    await startPolling(answer(false))
    expect(fetchMcpInfo).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(CONNECT_POLL_MS)
    expect(fetchMcpInfo).toHaveBeenCalledTimes(2)

    vi.mocked(fetchMcpInfo).mockResolvedValue(answer(true))
    await vi.advanceTimersByTimeAsync(CONNECT_POLL_MS)
    expect(fetchMcpInfo).toHaveBeenCalledTimes(3)
    expect(useMcpStore().connected).toBe(true)

    await vi.advanceTimersByTimeAsync(CONNECT_POLL_MS * 3)
    expect(fetchMcpInfo).toHaveBeenCalledTimes(3)
  })

  it('stops when the caller no longer waits or goes away', async () => {
    await startPolling(answer(false))

    waiting.value = false
    await vi.advanceTimersByTimeAsync(CONNECT_POLL_MS * 2)
    expect(fetchMcpInfo).toHaveBeenCalledOnce()

    waiting.value = true
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMcpInfo).toHaveBeenCalledTimes(2)

    scope?.stop()
    await vi.advanceTimersByTimeAsync(CONNECT_POLL_MS * 2)
    expect(fetchMcpInfo).toHaveBeenCalledTimes(2)
  })

  it('does not poll while connected or with the integration off', async () => {
    await startPolling(answer(true))
    await vi.advanceTimersByTimeAsync(CONNECT_POLL_MS * 2)
    expect(fetchMcpInfo).toHaveBeenCalledOnce()

    scope?.stop()
    setActivePinia(createPinia())
    vi.mocked(fetchMcpInfo).mockClear()

    await startPolling({ enabled: false, mcpUrl: null, oauth: false, claude: null })
    await vi.advanceTimersByTimeAsync(CONNECT_POLL_MS * 2)
    expect(fetchMcpInfo).toHaveBeenCalledOnce()
  })
})
