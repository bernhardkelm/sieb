import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchMcpInfo } from '@/api/tokensApi'
import { useMcpStore } from '@/stores/mcpStore'

vi.mock('@/api/tokensApi', () => ({
  fetchMcpInfo: vi.fn<typeof fetchMcpInfo>(),
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(fetchMcpInfo).mockReset()
})

describe('mcpStore', () => {
  it('counts as disabled while loading and enabled once the server says so', async () => {
    let resolve: (info: Awaited<ReturnType<typeof fetchMcpInfo>>) => void = () => {}

    vi.mocked(fetchMcpInfo).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )

    const store = useMcpStore()
    const loading = store.load()

    expect(store.enabled).toBe(false)

    resolve({ enabled: true, mcpUrl: 'https://sieb.example.com/mcp', oauth: true, claude: null })
    await loading

    expect(store.enabled).toBe(true)
    expect(store.info?.mcpUrl).toBe('https://sieb.example.com/mcp')
  })

  it('stays disabled when the server switched it off or the request fails', async () => {
    vi.mocked(fetchMcpInfo).mockResolvedValueOnce({
      enabled: false,
      mcpUrl: null,
      oauth: false,
      claude: null,
    })

    const store = useMcpStore()

    await store.load()
    expect(store.enabled).toBe(false)

    setActivePinia(createPinia())
    vi.mocked(fetchMcpInfo).mockRejectedValueOnce(new Error('offline'))

    const failing = useMcpStore()

    await failing.load()
    expect(failing.enabled).toBe(false)
    expect(failing.info).toBeNull()
  })

  it('loads only once per page view', async () => {
    vi.mocked(fetchMcpInfo).mockResolvedValue({
      enabled: true,
      mcpUrl: null,
      oauth: false,
      claude: null,
    })

    const store = useMcpStore()

    await Promise.all([store.load(), store.load()])
    await store.load()

    expect(fetchMcpInfo).toHaveBeenCalledOnce()
  })

  it('refreshes the connection state and keeps it when the refresh fails', async () => {
    const base = { enabled: true, mcpUrl: null, oauth: true }

    vi.mocked(fetchMcpInfo).mockResolvedValueOnce({
      ...base,
      claude: { connected: false, activeTokens: 0, oauthLastSeenAt: null },
    })

    const store = useMcpStore()

    await store.load()
    expect(store.connected).toBe(false)
    expect(store.connectReason).toBe(
      'Connect Claude first: create an API token (your name in the top bar, API tokens) or add the sieb connector in Claude.',
    )

    vi.mocked(fetchMcpInfo).mockResolvedValueOnce({
      ...base,
      claude: { connected: true, activeTokens: 0, oauthLastSeenAt: '2026-11-20T10:00:00.000Z' },
    })
    await store.refresh()

    expect(store.connected).toBe(true)
    expect(store.connectReason).toBeNull()

    vi.mocked(fetchMcpInfo).mockRejectedValueOnce(new Error('offline'))
    await store.refresh()

    expect(store.connected).toBe(true)
  })
})
