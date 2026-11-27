import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { InboxResponse, McpInfoResponse } from '#core/apiTypes.ts'
import type { CheckCreateResponse, ChecksResponse } from '#core/check.ts'
import { buildCheck, buildChecksResponse } from '@/__tests__/checkBuilders'
import { ApiError } from '@/api/ApiError'
import { fetchChecks } from '@/api/checksApi'
import { fetchInbox } from '@/api/inboxApi'
import { useChecksStore } from '@/stores/checksStore'
import { useMcpStore } from '@/stores/mcpStore'

vi.mock('@/api/checksApi', () => ({
  fetchChecks: vi.fn<() => Promise<ChecksResponse>>(),
  createChecks: vi.fn<(ids: number[]) => Promise<CheckCreateResponse>>(),
  cancelCheck: vi.fn<(id: number) => Promise<void>>(),
}))
vi.mock('@/api/inboxApi', () => ({
  fetchInbox: vi.fn<() => Promise<InboxResponse>>(async () => ({
    items: [],
    counts: { proposal: 0, reopened: 0, expiring: 0, kev: 0, total: 0 },
  })),
}))

const QUEUED = buildCheck({ id: 2, findingId: 7, position: 1 })
const RUNNING = buildCheck({
  id: 3,
  findingId: 8,
  state: 'running',
  phase: 'investigating',
  position: null,
  startedAt: '2026-06-01T11:59:00.000Z',
})
const FAILED = buildCheck({ id: 1, findingId: 9, state: 'failed', position: null, error: 'boom' })
const DONE = buildCheck({ id: 4, findingId: 9, state: 'done', position: null, proposalId: 5 })

/**
 * Builds an MCP info answer with the optional checksEnabled extension.
 * @param {boolean} checksEnabled - Whether the server reports Auto-check as on
 * @returns {McpInfoResponse} - Answer
 */
const mcpInfo = (checksEnabled: boolean): McpInfoResponse => ({
  enabled: true,
  mcpUrl: null,
  oauth: false,
  claude: null,
  checksEnabled,
})

/**
 * Lets the pending fetch settle and returns the number of fetches so far.
 * @returns {Promise<number>} - Calls of fetchChecks
 */
const fetches = async (): Promise<number> => {
  await flushPromises()
  return vi.mocked(fetchChecks).mock.calls.length
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(fetchChecks).mockReset().mockResolvedValue(buildChecksResponse())
  vi.mocked(fetchInbox).mockClear()
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
})

afterEach(() => {
  useChecksStore().stopPolling()
  vi.useRealTimers()
})

describe('checksStore lookup', () => {
  it('finds the open check per finding, the latest one for the panel and open or failed for rows', async () => {
    vi.mocked(fetchChecks).mockResolvedValue(
      buildChecksResponse({ running: RUNNING, queued: [QUEUED], recent: [FAILED] }),
    )
    const store = useChecksStore()

    await store.refresh()

    expect(store.open.map((check) => check.id)).toEqual([3, 2])
    expect(store.openFor(7)?.id).toBe(2)
    expect(store.openFor(9)).toBeNull()
    expect(store.latestFor(9)?.state).toBe('failed')
    expect(store.rowCheckFor(9)?.id).toBe(1)
    expect(store.rowCheckFor(1)).toBeNull()
  })

  it('keeps finished checks off the rows but on the panel', async () => {
    vi.mocked(fetchChecks).mockResolvedValue(buildChecksResponse({ recent: [DONE, FAILED] }))
    const store = useChecksStore()

    await store.refresh()

    expect(store.latestFor(9)?.id).toBe(4)
    expect(store.rowCheckFor(9)).toBeNull()
  })

  it('refetches the Inbox once an open check finished', async () => {
    const store = useChecksStore()

    vi.mocked(fetchChecks).mockResolvedValue(buildChecksResponse({ queued: [QUEUED] }))
    await store.refresh()
    expect(fetchInbox).not.toHaveBeenCalled()

    vi.mocked(fetchChecks).mockResolvedValue(
      buildChecksResponse({ recent: [{ ...QUEUED, state: 'done', proposalId: 5 }] }),
    )
    await store.refresh()
    expect(fetchInbox).toHaveBeenCalledTimes(1)
  })
})

describe('checksStore feature detection', () => {
  it('counts as off until an answer arrives, the MCP info decides before the checks answer', async () => {
    const store = useChecksStore()
    const mcp = useMcpStore()

    expect(store.enabled).toBe(false)
    mcp.info = mcpInfo(true)
    expect(store.enabled).toBe(true)

    vi.mocked(fetchChecks).mockResolvedValue(buildChecksResponse({ enabled: false }))
    await store.refresh()
    expect(store.enabled).toBe(false)
  })

  it('does not poll when the MCP info says the feature is off', async () => {
    useMcpStore().info = mcpInfo(false)
    useChecksStore().startPolling()

    expect(await fetches()).toBe(0)
  })

  it('treats a server without the checks route as off', async () => {
    vi.mocked(fetchChecks).mockRejectedValue(
      new ApiError(404, { error: 'not_found' }, '/api/checks'),
    )
    const store = useChecksStore()

    await store.refresh()

    expect(store.loaded).toBe(true)
    expect(store.enabled).toBe(false)
  })
})

describe('checksStore polling', () => {
  it('polls every 60 seconds while nothing is open', async () => {
    vi.useFakeTimers()
    useChecksStore().startPolling()
    expect(await fetches()).toBe(1)

    await vi.advanceTimersByTimeAsync(59_000)
    expect(await fetches()).toBe(1)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(await fetches()).toBe(2)
  })

  it('polls every 5 seconds while a check is queued or running', async () => {
    vi.useFakeTimers()
    vi.mocked(fetchChecks).mockResolvedValue(buildChecksResponse({ running: RUNNING }))
    useChecksStore().startPolling()
    expect(await fetches()).toBe(1)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(await fetches()).toBe(2)
  })

  it('polls every 5 seconds while the Checks page shows, and slows down once it is gone', async () => {
    vi.useFakeTimers()
    const store = useChecksStore()

    store.startPolling()
    await fetches()
    const release = store.showPage()
    expect(await fetches()).toBe(2)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(await fetches()).toBe(3)

    release()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(await fetches()).toBe(4)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(await fetches()).toBe(4)
  })

  it('stops polling once the server says the feature is off', async () => {
    vi.useFakeTimers()
    vi.mocked(fetchChecks).mockResolvedValue(buildChecksResponse({ enabled: false }))
    const store = useChecksStore()

    store.startPolling()
    expect(await fetches()).toBe(1)

    await vi.advanceTimersByTimeAsync(120_000)
    store.startPolling()
    store.showPage()
    expect(await fetches()).toBe(1)
  })
})
