import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import { fetchFindings } from '@/api/findingsApi'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { stubWindowLayout, type WindowLayout } from '@/__tests__/windowLayout'
import { useFindingsStore } from '@/stores/findingsStore'
import InboxView from '@/views/InboxView.vue'

vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<typeof fetchFindings>(),
  fetchFindingDetail: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))
vi.mock('@/api/labelsApi', () => ({
  fetchLabels: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))

const COUNT = 2000
const ROW = 32

let layout: WindowLayout
let mounted: RoutedMount | null = null

/**
 * Presses a key on the focused element, as the browser dispatches it to the window.
 * @param {string} key - KeyboardEvent key
 * @param {KeyboardEventInit} init - Modifiers
 * @returns {Promise<void>} - Resolves once the cursor settled and the row is focused
 */
const press = async (key: string, init: KeyboardEventInit = {}): Promise<void> => {
  const target = document.activeElement ?? document.body

  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  )
  await flushPromises()
}

/**
 * Returns the position of the focused option in the full inbox.
 * @returns {number | null} - One-based position, null when no option has focus
 */
const focusedPosition = (): number | null => {
  const position = document.activeElement?.getAttribute('aria-posinset')

  return position ? Number(position) : null
}

beforeEach(async () => {
  layout = stubWindowLayout(ROW)
  vi.mocked(fetchFindings).mockResolvedValue(
    Array.from({ length: COUNT }, (_, index) => buildFindingView({ id: index + 1 })),
  )
  mounted = await mountWithRouter(InboxView, '/inbox')
  await useFindingsStore().refresh()
  await flushPromises()
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  layout.restore()
  document.body.innerHTML = ''
})

describe('InboxView with a virtualized list', () => {
  it('renders a window of rows while every row counts', () => {
    const options = document.querySelectorAll('[role="option"]')

    expect(options.length).toBeLessThan(60)
    expect(options[0]!.getAttribute('aria-setsize')).toBe(String(COUNT))
  })

  it('moves focus to rows that were not rendered with End, Home and PageDown', async () => {
    await press('End')
    expect(focusedPosition()).toBe(COUNT)
    expect(layout.scrollY()).toBeGreaterThan(COUNT * ROW - 1000)

    await press('Home')
    expect(focusedPosition()).toBe(1)
    expect(layout.scrollY()).toBe(0)

    await press('PageDown')
    expect(focusedPosition()).toBe(1 + 768 / ROW - 1)
  })

  it('keeps focus on the cursor row through a held j', async () => {
    for (let step = 0; step < 60; step += 1) {
      await press('j', { repeat: step > 0 })
      expect(focusedPosition()).toBe(step + 2)
    }
  })

  it('checks every finding with the select-all chord, rendered or not', async () => {
    await press('a', { ctrlKey: true })

    expect(mounted!.wrapper.text()).toContain(`${COUNT} selected`)
  })

  it('checks a range over unrendered rows with Shift+End', async () => {
    await press('j')
    await press('End', { shiftKey: true })

    expect(focusedPosition()).toBe(COUNT)
    expect(mounted!.wrapper.text()).toContain(`${COUNT - 1} selected`)
  })
})
