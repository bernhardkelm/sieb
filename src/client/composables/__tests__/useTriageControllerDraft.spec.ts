import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h } from 'vue'
import { useRoute } from 'vue-router'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { FindingDetail } from '#core/findingView.ts'
import { fetchFindings } from '@/api/findingsApi'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import FindingDecisions from '@/components/finding/FindingDecisions.vue'
import { useTriageController } from '@/composables/useTriageController'

vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<typeof fetchFindings>(),
  fetchFindingDetail: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))

let mounted: RoutedMount | null = null

const PanelHost = defineComponent({
  setup: () => {
    const route = useRoute()

    useTriageController(() => {})

    const detail = computed<FindingDetail | null>(() => {
      const id = Number(route.query.finding)

      return id
        ? { finding: buildFindingView({ id }), instances: [], decisions: [], events: [], kev: null }
        : null
    })

    return () => h('div', [detail.value ? h(FindingDecisions, { detail: detail.value }) : null])
  },
})

/**
 * Presses a key on the page body, as the browser dispatches it to the window.
 * @param {string} key - KeyboardEvent key
 * @returns {Promise<void>} - Resolves after navigation settled
 */
const press = async (key: string): Promise<void> => {
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  )
  await flushPromises()
}

/**
 * Clicks a button by its label.
 * @param {string} label - Button label
 * @returns {Promise<void>} - Resolves after the update and the dialog focus timer
 */
const clickButton = async (label: string): Promise<void> => {
  const button = [...document.querySelectorAll('button')].find(
    (item) => item.textContent?.trim() === label,
  )

  button?.click()
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve))
}

/**
 * Returns the label of the checked status option.
 * @returns {string | undefined} - Label, undefined while none is checked
 */
const checkedStatus = (): string | undefined =>
  document
    .querySelector('[aria-label="Status"] [role="radio"][aria-checked="true"]')
    ?.textContent?.trim()

beforeEach(() => {
  vi.mocked(fetchFindings).mockResolvedValue([
    buildFindingView({ id: 1, imageRef: 'index.docker.io/library/nginx' }),
    buildFindingView({ id: 2, imageRef: 'index.docker.io/library/redis' }),
  ])
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  document.body.innerHTML = ''
})

describe('useTriageController with an unsaved draft', () => {
  it('drops the decision key request when Keep editing cancels the navigation', async () => {
    mounted = await mountWithRouter(PanelHost, '/triage?finding=99')
    await flushPromises()
    const { router } = mounted
    const reason = document.querySelector('textarea')!

    reason.value = 'vendored'
    reason.dispatchEvent(new Event('input'))
    await flushPromises()

    await press('n')
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain(
      'Discard the unsaved decision?',
    )

    await clickButton('Keep editing')
    expect(router.currentRoute.value.query.finding).toBe('99')

    await clickButton('Cancel')
    await press('Enter')

    expect(router.currentRoute.value.query.finding).toBe('1')
    expect(document.querySelector('textarea')?.value).toBe('')
    expect(checkedStatus()).toBeUndefined()
  })

  it('still opens the form with the status when the navigation goes through', async () => {
    mounted = await mountWithRouter(PanelHost, '/triage?finding=99')
    await flushPromises()

    await press('n')

    expect(mounted.router.currentRoute.value.query.finding).toBe('1')
    expect(checkedStatus()).toBe('Not affected')
  })
})
