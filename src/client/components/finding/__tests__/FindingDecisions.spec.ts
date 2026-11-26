import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Router } from 'vue-router'

import { buildDecision, buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { FindingDetail } from '#core/findingView.ts'
import { createDecision, updateDecision } from '@/api/decisionsApi'
import { mountWithRouter } from '@/__tests__/mountWithRouter'
import { reopenedEffective } from '@/__tests__/reopenedEffective'
import FindingDecisions from '@/components/finding/FindingDecisions.vue'
import { useFindingDetailStore } from '@/stores/findingDetailStore'

vi.mock('@/api/decisionsApi', () => ({
  createDecision: vi.fn<typeof createDecision>(),
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
let router: Router

const Host = defineComponent({
  setup: () => () => h(FindingDecisions, { detail: detail.value }),
})

/**
 * Mounts the decisions of the panel for the current detail, on the inbox with finding 1 open.
 * @returns {Promise<VueWrapper>} - Mounted host
 */
const mountDecisions = async (): Promise<VueWrapper> => {
  const routed = await mountWithRouter(Host, '/inbox?finding=1')

  wrapper = routed.wrapper
  router = routed.router
  return wrapper
}

/**
 * Returns the discard question while it is open.
 * @returns {HTMLElement | null} - Alert dialog
 */
const question = (): HTMLElement | null => document.querySelector('[role="alertdialog"]')

/**
 * Clicks the button of the open discard question with a label.
 * @param {string} label - Button label
 * @returns {Promise<void>} - Resolves after the dialog settled
 */
const answer = async (label: string): Promise<void> => {
  const button = [...(question()?.querySelectorAll('button') ?? [])].find(
    (item) => item.textContent?.trim() === label,
  )

  button?.click()
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve))
}

/**
 * Mounts a finding without decision and types a reason into its form.
 * @returns {Promise<VueWrapper>} - Mounted host with a dirty draft
 */
const mountDraft = async (): Promise<VueWrapper> => {
  detail.value = { ...expiredDetail(1), decisions: [] }
  const host = await mountDecisions()

  await host.get('textarea').setValue('vendored')
  return host
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('FindingDecisions', () => {
  it('opens the requested form when the request arrives together with the finding switch', async () => {
    detail.value = expiredDetail(1)
    const host = await mountDecisions()
    const store = useFindingDetailStore()

    expect(host.find('textarea').exists()).toBe(false)

    store.requestDecision(2, 'accepted')
    detail.value = expiredDetail(2)
    await flushPromises()

    expect(host.get('textarea').element.value).toBe('reason 2')
  })

  it('reports an unsaved draft to the store and clears it with the panel', async () => {
    const host = await mountDraft()
    const store = useFindingDetailStore()

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
    const host = await mountDecisions()

    expect(host.text()).toContain('Severity rose from Low to Critical on nginx')
    expect(host.text()).toContain('saving other changes keeps it re-opened')

    await host
      .findAll('button')
      .find((button) => button.text() === 'Re-confirm')!
      .trigger('click')

    expect(updateDecision).toHaveBeenCalledWith(4, { reconfirm: true })
  })

  it('asks before another finding replaces a dirty draft and keeps it on Keep editing', async () => {
    const host = await mountDraft()
    const navigation = router.replace('/inbox?finding=2')
    await flushPromises()

    expect(question()?.textContent).toContain('Discard the unsaved decision?')

    await answer('Keep editing')
    await navigation

    expect(question()).toBeNull()
    expect(router.currentRoute.value.query.finding).toBe('1')
    expect(host.get('textarea').element.value).toBe('vendored')
    expect(document.activeElement).toBe(host.get('textarea').element)
  })

  it('lets a view change proceed on Discard', async () => {
    await mountDraft()
    const navigation = router.push({ name: 'images' })
    await flushPromises()

    await answer('Discard')
    await navigation

    expect(router.currentRoute.value.name).toBe('images')
    expect(router.currentRoute.value.query.finding).toBeUndefined()
  })

  it('does not ask once the draft is saved', async () => {
    const decision = buildDecision({ id: 9, reason: 'vendored' })
    vi.mocked(createDecision).mockResolvedValue({
      decision,
      effective: { state: 'active' },
      openFindings: 1,
    })
    const host = await mountDraft()

    await host
      .findAll('[role="radio"]')
      .find((item) => item.text() === 'Not affected')!
      .trigger('click')
    await host.get('form').trigger('submit')
    await flushPromises()
    expect(createDecision).toHaveBeenCalled()

    await router.replace('/inbox?finding=2')
    expect(question()).toBeNull()
    expect(router.currentRoute.value.query.finding).toBe('2')
  })

  it('does not ask once the draft is cancelled, which empties the form', async () => {
    const host = await mountDraft()
    const store = useFindingDetailStore()

    expect(store.draftDirty).toBe(true)
    await host
      .findAll('button')
      .find((button) => button.text() === 'Cancel')!
      .trigger('click')
    await flushPromises()

    expect(host.get('textarea').element.value).toBe('')
    expect(store.draftDirty).toBe(false)
    await router.replace('/inbox')
    expect(question()).toBeNull()
    expect(router.currentRoute.value.query.finding).toBeUndefined()
  })
})
