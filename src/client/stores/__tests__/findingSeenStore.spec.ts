import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import { MAX_SEEN_FINDINGS } from '#core/findingSeen.ts'
import type { FindingView } from '#core/findingView.ts'
import { fetchFindings, markFindingsSeen } from '@/api/findingsApi'
import { SEEN_FLUSH_MS, useFindingSeenStore } from '@/stores/findingSeenStore'
import { useFindingsStore } from '@/stores/findingsStore'
import { notifyError } from '@/toast/toastManager'

vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<typeof fetchFindings>(),
  markFindingsSeen: vi.fn<typeof markFindingsSeen>(async () => ({ ignored: [] })),
}))
vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
}))

const NOW = new Date('2026-06-01T12:00:00.000Z')
const RECENT = '2026-05-31T00:00:00.000Z'

/**
 * Loads findings into the findings store.
 * @param {FindingView[]} findings - Findings the API returns
 * @returns {Promise<void>} - Resolves once loaded
 */
const load = async (findings: FindingView[]): Promise<void> => {
  vi.mocked(fetchFindings).mockResolvedValue(findings)
  await useFindingsStore().refresh()
}

/**
 * Returns the seen state of every loaded finding.
 * @returns {[number, boolean | undefined][]} - Id and seen
 */
const seenStates = (): [number, boolean | undefined][] =>
  useFindingsStore().items.map((finding) => [finding.id, finding.seen])

/**
 * Returns the id lists of the mark requests.
 * @returns {number[][]} - Ids per request
 */
const requests = (): number[][] => vi.mocked(markFindingsSeen).mock.calls.map(([ids]) => ids)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(NOW)
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('findingSeenStore', () => {
  it('drops the tag at once and sends the marks in one request once marking pauses', async () => {
    await load([1, 2, 3].map((id) => buildFindingView({ id, firstSeen: RECENT, seen: false })))
    const seen = useFindingSeenStore()

    seen.markSeen([1])
    expect(seenStates()).toEqual([
      [1, true],
      [2, false],
      [3, false],
    ])

    vi.advanceTimersByTime(SEEN_FLUSH_MS - 1)
    seen.markSeen([2, 1])
    vi.advanceTimersByTime(SEEN_FLUSH_MS - 1)
    expect(markFindingsSeen).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(requests()).toEqual([[1, 2]])
  })

  it('sends nothing for findings already seen or not recent', async () => {
    await load([
      buildFindingView({ id: 1, firstSeen: RECENT, seen: true }),
      buildFindingView({ id: 2, firstSeen: '2026-05-01T00:00:00.000Z', seen: false }),
    ])

    useFindingSeenStore().markSeen([1, 2])
    await vi.advanceTimersByTimeAsync(SEEN_FLUSH_MS * 2)

    expect(markFindingsSeen).not.toHaveBeenCalled()
  })

  it('splits large batches into requests the server accepts', async () => {
    const ids = Array.from({ length: MAX_SEEN_FINDINGS + 5 }, (_, index) => index + 1)

    useFindingSeenStore().markSeen(ids)
    await vi.advanceTimersByTimeAsync(SEEN_FLUSH_MS)

    expect(requests()).toEqual([ids.slice(0, MAX_SEEN_FINDINGS), ids.slice(MAX_SEEN_FINDINGS)])
  })

  it('keeps the marks of a failed request quietly and retries them with the next mark', async () => {
    await load([1, 2].map((id) => buildFindingView({ id, firstSeen: RECENT, seen: false })))
    const seen = useFindingSeenStore()

    vi.mocked(markFindingsSeen).mockRejectedValueOnce(new Error('offline'))
    seen.markSeen([1])
    await vi.advanceTimersByTimeAsync(SEEN_FLUSH_MS)
    await vi.advanceTimersByTimeAsync(SEEN_FLUSH_MS * 5)

    expect(requests()).toEqual([[1]])
    expect(seenStates()).toEqual([
      [1, true],
      [2, false],
    ])
    expect(notifyError).not.toHaveBeenCalled()

    seen.markSeen([2])
    await vi.advanceTimersByTimeAsync(SEEN_FLUSH_MS)

    expect(requests()).toEqual([[1], [1, 2]])
  })

  it('keeps local marks over a refetch that answers before the write', async () => {
    await load([buildFindingView({ id: 1, firstSeen: RECENT, seen: false })])

    useFindingSeenStore().markSeen([1])
    await load([buildFindingView({ id: 1, firstSeen: RECENT, seen: false })])

    expect(seenStates()).toEqual([[1, true]])
  })
})
