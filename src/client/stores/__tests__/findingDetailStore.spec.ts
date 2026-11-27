import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { FindingDetailResponse } from '#core/findingApiTypes.ts'
import { ApiError } from '@/api/ApiError'
import { fetchFindingDetail } from '@/api/findingsApi'
import { useFindingDetailStore } from '@/stores/findingDetailStore'

vi.mock('@/api/findingsApi', () => ({
  fetchFindingDetail: vi.fn<(id: number) => Promise<FindingDetailResponse>>(),
}))

/**
 * Builds the detail of a finding.
 * @param {number} id - Finding id
 * @returns {FindingDetailResponse} - Detail
 */
const detailOf = (id: number): FindingDetailResponse => ({
  finding: buildFindingView({ id }),
  instances: [],
  decisions: [],
  events: [],
  kev: null,
  sourceAccess: 'public',
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(fetchFindingDetail).mockReset()
})

describe('findingDetailStore', () => {
  it('drops the answer of a superseded request', async () => {
    const answers = new Map<number, (detail: FindingDetailResponse) => void>()
    vi.mocked(fetchFindingDetail).mockImplementation(
      (id) =>
        new Promise((resolve) => {
          answers.set(id, resolve)
        }),
    )
    const store = useFindingDetailStore()

    const first = store.load(1)
    const second = store.load(2)

    answers.get(2)!(detailOf(2))
    await second
    answers.get(1)!(detailOf(1))
    await first

    expect(store.detail?.finding.id).toBe(2)
    expect(store.loading).toBe(false)
  })

  it('drops a late failure of a superseded request and flags a missing finding', async () => {
    let fail: (error: unknown) => void = () => {}
    vi.mocked(fetchFindingDetail)
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          fail = reject
        }),
      )
      .mockRejectedValueOnce(new ApiError(404, { error: 'not_found' }, '/api/findings/9'))
    const store = useFindingDetailStore()

    const first = store.load(1)
    await store.load(9)
    fail(new Error('late'))
    await first

    expect(store.notFound).toBe(true)
    expect(store.error).toBe('This decision or finding no longer exists.')
  })

  it('forgets the draft flag when the panel closes', () => {
    const store = useFindingDetailStore()

    store.setDraftDirty(true)
    store.clear()

    expect(store.draftDirty).toBe(false)
  })
})
