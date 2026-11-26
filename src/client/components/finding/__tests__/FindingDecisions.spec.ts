import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { TooltipProvider } from 'reka-ui'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import { buildDecision, buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { FindingDetail } from '#core/findingView.ts'
import { updateDecision } from '@/api/decisionsApi'
import { reopenedEffective } from '@/__tests__/reopenedEffective'
import FindingDecisions from '@/components/finding/FindingDecisions.vue'
import { useFindingDetailStore } from '@/stores/findingDetailStore'

vi.mock('@/api/decisionsApi', () => ({
  createDecision: vi.fn<() => Promise<never>>(),
  updateDecision: vi.fn<typeof updateDecision>(),
  revokeDecision: vi.fn<() => Promise<never>>(),
  createBulkDecisions: vi.fn<() => Promise<never>>(),
}))
vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
  notifySuccess: vi.fn<(title: string, description?: string) => void>(),
}))

/**
 * Builds the detail of a finding governed by its own expired image decision.
 * @param {number} id - Finding id, also the decision id
 * @returns {FindingDetail} - Detail
 */
const expiredDetail = (id: number): FindingDetail => {
  const decision = buildDecision({
    id,
    reason: `reason ${id}`,
    expiresAt: '2026-05-01T00:00:00.000Z',
  })

  return {
    finding: buildFindingView({ id, decision }),
    instances: [],
    decisions: [
      {
        decision,
        effective: { state: 'expired', expiresAt: decision.expiresAt! },
        openFindings: 1,
      },
    ],
    events: [],
    kev: null,
  }
}

const detail = ref<FindingDetail>(expiredDetail(1))
let wrapper: VueWrapper | null = null

/**
 * Mounts the decisions of the panel for the current detail.
 * @returns {VueWrapper} - Mounted host
 */
const mountDecisions = (): VueWrapper => {
  const pinia = createPinia()

  setActivePinia(pinia)

  const host = defineComponent({
    setup: () => () =>
      h(TooltipProvider, null, { default: () => h(FindingDecisions, { detail: detail.value }) }),
  })

  wrapper = mount(host, { global: { plugins: [pinia] }, attachTo: document.body })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('FindingDecisions', () => {
  it('opens the requested form when the request arrives together with the finding switch', async () => {
    detail.value = expiredDetail(1)
    const host = mountDecisions()
    const store = useFindingDetailStore()

    expect(host.find('textarea').exists()).toBe(false)

    store.requestDecision(2, 'accepted')
    detail.value = expiredDetail(2)
    await flushPromises()

    expect(host.get('textarea').element.value).toBe('reason 2')
  })

  it('reports an unsaved draft to the store and clears it with the panel', async () => {
    detail.value = { ...expiredDetail(1), decisions: [] }
    const host = mountDecisions()
    const store = useFindingDetailStore()

    await host.get('textarea').setValue('vendored')
    expect(store.draftDirty).toBe(true)
    expect(host.text()).toContain('Unsaved draft')

    host.unmount()
    wrapper = null
    expect(store.draftDirty).toBe(false)
  })

  it('re-confirms a re-opened decision from its card', async () => {
    const decision = buildDecision({ id: 4, reopenedAt: '2026-05-31T00:00:00.000Z' })
    const view = { decision, effective: reopenedEffective(), openFindings: 1 }
    detail.value = {
      finding: buildFindingView({ id: 4, decision, effective: view.effective }),
      instances: [],
      decisions: [view],
      events: [],
      kev: null,
    }
    vi.mocked(updateDecision).mockResolvedValue({ ...view, effective: { state: 'active' } })
    const host = mountDecisions()

    expect(host.text()).toContain('Severity rose from Low to Critical on nginx')
    expect(host.text()).toContain('saving other changes keeps it re-opened')

    await host
      .findAll('button')
      .find((button) => button.text() === 'Re-confirm')!
      .trigger('click')

    expect(updateDecision).toHaveBeenCalledWith(4, { reconfirm: true })
  })
})
