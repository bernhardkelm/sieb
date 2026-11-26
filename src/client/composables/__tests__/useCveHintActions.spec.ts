import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'

import type { CveAggregate } from '#core/cveAggregation.ts'
import { useCveHintActions } from '@/composables/useCveHintActions'
import { useHintActionsStore } from '@/stores/hintActionsStore'

let scope: EffectScope
const current = ref<CveAggregate | null>(null)
const openBulk = vi.fn<(vulnId: string) => void>()
const openDecideAll = vi.fn<(vulnId: string) => void>()

/**
 * Builds a CVE aggregate with undecided images.
 * @param {Partial<CveAggregate>} overrides - Fields to set
 * @returns {CveAggregate} - Aggregate
 */
const cve = (overrides: Partial<CveAggregate> = {}): CveAggregate => ({
  vulnId: 'CVE-2025-1000',
  title: null,
  primaryLink: null,
  kev: false,
  maxSeverity: 'High',
  maxScore: null,
  maxExposure: null,
  imageCount: 2,
  imageRefs: [],
  openCount: 2,
  inboxCount: 1,
  decisionStates: { undecided: 1, active: 1, fix_planned: 0, expired: 0, reopened: 0, revoked: 0 },
  allScopeDecision: null,
  ...overrides,
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  current.value = cve()
  scope = effectScope()
  scope.run(() => {
    useCveHintActions({
      currentCve: () => current.value,
      openBulk,
      openDecideAll,
      focusSearch: () => {},
      refocus: async () => {},
    })
  })
})

afterEach(() => {
  scope.stop()
})

describe('useCveHintActions', () => {
  it('opens both dialogs for the cursor CVE', async () => {
    const hints = useHintActionsStore()

    await hints.run('decideOpen')
    await hints.run('decideAll')

    expect(openBulk).toHaveBeenCalledWith('CVE-2025-1000')
    expect(openDecideAll).toHaveBeenCalledWith('CVE-2025-1000')
  })

  it('blocks both without a cursor CVE and decide open once every image is decided', () => {
    const hints = useHintActionsStore()

    current.value = cve({ inboxCount: 0 })
    expect(hints.reasonOf('decideOpen')).toBe('Every open image is decided')
    expect(hints.reasonOf('decideAll')).toBeNull()

    current.value = null
    expect(hints.reasonOf('decideOpen')).toBe('No CVE under the cursor')
    expect(hints.reasonOf('decideAll')).toBe('No CVE under the cursor')
  })
})
