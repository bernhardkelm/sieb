import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, type EffectScope } from 'vue'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import { fetchMcpInfo } from '@/api/tokensApi'
import { useSelectionHandoffButtons } from '@/composables/useSelectionHandoffButtons'
import { useSelectionStore } from '@/stores/selectionStore'
import { useHandoffTargetStore } from '@/stores/handoffTargetStore'
import { CONNECT_POLL_MS, useMcpStore } from '@/stores/mcpStore'

vi.mock('@/api/tokensApi', () => ({
  fetchMcpInfo: vi.fn<typeof fetchMcpInfo>(),
}))

let scope: EffectScope | null = null

/**
 * Loads an enabled integration with Claude not connected and creates the buttons in a fresh
 * effect scope, as a mounted selection bar does.
 * @returns {Promise<void>} - Resolves once loaded
 */
const createButtons = async (): Promise<void> => {
  vi.mocked(fetchMcpInfo).mockResolvedValue({
    enabled: true,
    mcpUrl: null,
    oauth: true,
    claude: { connected: false, activeTokens: 0, oauthLastSeenAt: null },
  })
  await useMcpStore().load()
  scope = effectScope()
  scope.run(() => useSelectionHandoffButtons())
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  setActivePinia(createPinia())
  vi.mocked(fetchMcpInfo).mockReset()
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
})

afterEach(() => {
  scope?.stop()
  scope = null
  vi.useRealTimers()
})

describe('useSelectionHandoffButtons connection poll', () => {
  it('does not poll without checked rows', async () => {
    await createButtons()
    await vi.advanceTimersByTimeAsync(CONNECT_POLL_MS * 3)

    expect(fetchMcpInfo).toHaveBeenCalledOnce()
  })

  it('polls while rows are checked and stops once they are cleared', async () => {
    await createButtons()
    const unregister = useSelectionStore().register(() => [buildFindingView({ id: 1 })])

    await vi.advanceTimersByTimeAsync(CONNECT_POLL_MS * 2)
    const polled = vi.mocked(fetchMcpInfo).mock.calls.length

    expect(polled).toBeGreaterThan(1)

    unregister()
    await vi.advanceTimersByTimeAsync(CONNECT_POLL_MS * 3)
    expect(fetchMcpInfo).toHaveBeenCalledTimes(polled)
  })

  it('does not poll while copying is the default action', async () => {
    await createButtons()
    useHandoffTargetStore().setPreferred('copy')
    useSelectionStore().register(() => [buildFindingView({ id: 1 })])

    await vi.advanceTimersByTimeAsync(CONNECT_POLL_MS * 3)
    expect(fetchMcpInfo).toHaveBeenCalledOnce()
  })
})
