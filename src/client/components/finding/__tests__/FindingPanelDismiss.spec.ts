import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { FindingDetailResponse } from '#core/findingApiTypes.ts'
import { mountWithRouter } from '@/__tests__/mountWithRouter'
import { fetchFindingDetail } from '@/api/findingsApi'
import FindingPanel from '@/components/finding/FindingPanel.vue'
import { SHEET_QUERY } from '@/composables/usePanelDismiss'

vi.mock('@/api/findingsApi', () => ({
  fetchFindingDetail: vi.fn<(id: number) => Promise<FindingDetailResponse>>(),
}))

let wrapper: VueWrapper | null = null
let router: Router

/**
 * Opens the panel of finding 1 next to a list row and a button outside of it.
 * @returns {Promise<void>} - Resolves once the detail rendered
 */
const openPanel = async (): Promise<void> => {
  document.body.innerHTML =
    '<div role="option" class="row">row</div><button type="button" class="outside">x</button>' +
    '<div class="list-area" data-list-background><span class="label">label</span></div>'
  const routed = await mountWithRouter(FindingPanel, '/triage?finding=1')

  wrapper = routed.wrapper
  router = routed.router
  await flushPromises()
}

/**
 * Presses the primary pointer button on an element.
 * @param {Element} target - Pressed element
 * @returns {Promise<void>} - Resolves once the navigation settled
 */
const press = async (target: Element): Promise<void> => {
  target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
  await flushPromises()
}

/**
 * Returns the finding the panel shows according to the URL.
 * @returns {unknown} - Finding query param
 */
const openFinding = (): unknown => router.currentRoute.value.query.finding

beforeEach(() => {
  vi.mocked(fetchFindingDetail).mockResolvedValue({
    finding: buildFindingView({ id: 1 }),
    instances: [],
    decisions: [],
    events: [],
    kev: null,
    imageVisibility: 'public',
    ownership: 'third_party',
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('FindingPanel outside press', () => {
  it('closes the panel on a press outside of it', async () => {
    await openPanel()

    await press(document.querySelector('.outside')!)

    expect(openFinding()).toBeUndefined()
  })

  it('stays open for presses inside the panel, on list rows and with the right button', async () => {
    await openPanel()

    await press(document.querySelector('.finding-panel h2')!)
    await press(document.querySelector('.row')!)
    document
      .querySelector('.outside')!
      .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 2 }))
    await flushPromises()

    expect(openFinding()).toBe('1')
  })

  it('stays open for a press on empty list space that clears checked rows', async () => {
    await openPanel()
    const area = document.querySelector('.list-area')!

    area.setAttribute('data-list-checked', '')
    await press(area)
    expect(openFinding()).toBe('1')

    await press(document.querySelector('.list-area .label')!)
    expect(openFinding()).toBeUndefined()
  })

  it('closes for a press on empty list space without checked rows', async () => {
    await openPanel()

    await press(document.querySelector('.list-area')!)

    expect(openFinding()).toBeUndefined()
  })

  it('leaves the full screen sheet alone', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === SHEET_QUERY }))
    await openPanel()

    await press(document.querySelector('.outside')!)

    expect(openFinding()).toBe('1')
  })

  it('asks before a press outside discards an unsaved draft', async () => {
    await openPanel()
    await wrapper!.get('textarea').setValue('vendored')

    await press(document.querySelector('.outside')!)

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain(
      'Discard the unsaved decision?',
    )
    expect(openFinding()).toBe('1')
  })
})
