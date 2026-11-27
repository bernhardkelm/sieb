import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { stubWindowLayout, type WindowLayout } from '@/__tests__/windowLayout'
import { fetchDecisions } from '@/api/decisionsApi'
import { fetchFindings } from '@/api/findingsApi'
import { useFindingsStore } from '@/stores/findingsStore'
import TriageView from '@/views/TriageView.vue'

vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<typeof fetchFindings>(),
  fetchFindingDetail: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))
vi.mock('@/api/decisionsApi', () => ({
  fetchDecisions: vi.fn<typeof fetchDecisions>(),
}))
vi.mock('@/api/labelsApi', () => ({
  fetchLabels: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))

let layout: WindowLayout
let mounted: RoutedMount | null = null

/**
 * Mounts the triage view with three findings, the panel of finding 1 open.
 * @returns {Promise<RoutedMount>} - Mounted view once the findings are listed
 */
const mountTriage = async (): Promise<RoutedMount> => {
  vi.mocked(fetchFindings).mockResolvedValue([1, 2, 3].map((id) => buildFindingView({ id })))
  vi.mocked(fetchDecisions).mockResolvedValue([])
  mounted = await mountWithRouter(TriageView, '/triage?finding=1')
  await useFindingsStore().refresh()
  await flushPromises()
  return mounted
}

/**
 * Returns the row element of a finding.
 * @param {number} id - Finding id
 * @returns {HTMLElement} - Row
 */
const rowOf = (id: number): HTMLElement =>
  document.querySelector<HTMLElement>(`[data-finding-id="${id}"]`)!

/**
 * Checks rows with a click on their checkbox.
 * @param {number[]} ids - Finding ids
 * @returns {Promise<void>} - Resolves once settled
 */
const check = async (...ids: number[]): Promise<void> => {
  for (const id of ids) {
    rowOf(id)
      .querySelector('.row-checkbox')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
  }
}

/**
 * Presses and releases the primary button, the release optionally on another element, moved
 * or with a modifier.
 * @param {Element} target - Pressed element
 * @param {{ release?: Element; dx?: number; shiftKey?: boolean }} options - Release target, travel in px and modifier
 * @returns {Promise<void>} - Resolves once settled
 */
const clickOn = async (
  target: Element,
  {
    release = target,
    dx = 0,
    shiftKey = false,
  }: { release?: Element; dx?: number; shiftKey?: boolean } = {},
): Promise<void> => {
  target.dispatchEvent(
    new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }),
  )
  release.dispatchEvent(
    new MouseEvent('click', { bubbles: true, button: 0, clientX: 10 + dx, clientY: 10, shiftKey }),
  )
  await flushPromises()
}

/**
 * Returns the checked finding ids.
 * @returns {string[]} - Ids in list order
 */
const checkedIds = (): string[] =>
  [...document.querySelectorAll('.list-row.checked')].map((row) =>
    row.getAttribute('data-finding-id')!,
  )

/**
 * Returns the finding id of the cursor row.
 * @returns {string | null} - Id, null without a cursor row
 */
const cursorId = (): string | null =>
  document.querySelector('.list-row.current')?.getAttribute('data-finding-id') ?? null

beforeEach(() => {
  layout = stubWindowLayout(32)
  HTMLElement.prototype.scrollIntoView = vi.fn<HTMLElement['scrollIntoView']>()
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  layout.restore()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('TriageView click on empty list space', () => {
  it('clears the checked rows, the cursor row and the panel stay', async () => {
    const { router } = await mountTriage()

    await check(2, 3)
    const cursor = cursorId()

    expect(checkedIds()).toEqual(['2', '3'])
    expect(document.querySelector('.triage-view')?.hasAttribute('data-list-checked')).toBe(true)

    await clickOn(document.querySelector('.triage-view')!)

    expect(checkedIds()).toEqual([])
    expect(cursorId()).toBe(cursor)
    expect(router.currentRoute.value.query.finding).toBe('1')
    expect(document.querySelector('.triage-view')?.hasAttribute('data-list-checked')).toBe(false)

    await check(2)
    await clickOn(document.querySelector('.dense-list .origin')!)
    expect(checkedIds()).toEqual([])
  })

  it('keeps the checked rows for clicks on rows, checkboxes, buttons and headers', async () => {
    await mountTriage()
    await check(2, 3)

    await clickOn(rowOf(1).querySelector('.vuln-id')!)
    expect(checkedIds()).toEqual(['2', '3'])

    await check(1)
    expect(checkedIds()).toEqual(['1', '2', '3'])

    await clickOn(document.querySelector('.list-header')!)
    await clickOn(document.querySelector('.selection-bar .count')!)
    expect(checkedIds()).toEqual(['1', '2', '3'])
  })

  it('keeps the checked rows after a drag, a text selection, a modifier or a press elsewhere', async () => {
    await mountTriage()
    await check(2)
    const root = document.querySelector('.triage-view')!

    await clickOn(root, { dx: 20 })
    await clickOn(root, { shiftKey: true })
    await clickOn(rowOf(1), { release: root })

    const selection = vi.spyOn(window, 'getSelection')

    selection.mockReturnValue({ toString: () => 'CVE-2099' } as Selection)
    await clickOn(root)
    expect(checkedIds()).toEqual(['2'])

    selection.mockRestore()
    await clickOn(root)
    expect(checkedIds()).toEqual([])
  })
})
