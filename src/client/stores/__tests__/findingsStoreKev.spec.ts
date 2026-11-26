import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import { useFindingsStore } from '@/stores/findingsStore'
import { useLabelsStore } from '@/stores/labelsStore'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('findings store KEV filter', () => {
  it('keeps KEV findings only, resets, and is ignored when the KEV source is none', () => {
    const store = useFindingsStore()
    const labels = useLabelsStore()

    store.items = [buildFindingView({ id: 1, kev: true }), buildFindingView({ id: 2, kev: false })]
    labels.data = { exposure: false, owners: [], kev: 'cisa' }

    store.setFilters({ kev: true })
    expect(store.inbox.map((finding) => finding.id)).toEqual([1])

    labels.data = { exposure: false, owners: [], kev: 'none' }
    expect(store.inbox.map((finding) => finding.id)).toEqual([1, 2])

    labels.data = { exposure: false, owners: [], kev: 'prometheus' }
    store.resetFilters()
    expect(store.inbox.map((finding) => finding.id)).toEqual([1, 2])
  })
})
