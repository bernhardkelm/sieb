import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref, type Component, type ShallowRef } from 'vue'

import { stubWindowLayout, type WindowLayout } from '@/__tests__/windowLayout'
import DenseList from '@/components/list/DenseList.vue'
import { provideListViewport, type ListViewport } from '@/composables/useListViewport'

const ROW = 32
const COUNT = 2000

let layout: WindowLayout
let wrapper: VueWrapper | null = null
let viewport: ShallowRef<ListViewport<number> | null>
const pinned = ref<number | null>(null)

/**
 * Mounts a virtualized list of numbered rows inside a host that provides the viewport slot, as
 * a view does through its list cursor.
 * @param {'listbox' | 'treegrid'} kind - ARIA pattern of the list
 * @returns {Promise<VueWrapper>} - Wrapper once the first rows are rendered and measured
 */
const mountList = async (kind: 'listbox' | 'treegrid' = 'listbox'): Promise<VueWrapper> => {
  const items = Array.from({ length: COUNT }, (_, index) => index)
  const Host = defineComponent({
    setup: () => {
      viewport = provideListViewport<number>()

      return () =>
        h(
          DenseList as unknown as Component,
          {
            label: 'Rows',
            kind,
            items,
            keyOf: (item: number) => item,
            estimate: () => ROW,
            pinned: pinned.value,
          },
          {
            header: kind === 'treegrid' ? () => h('li', { role: 'row' }, 'Header') : undefined,
            default: (scope: {
              item: number
              attrs: Record<string, unknown>
              measure: (target: unknown) => void
            }) =>
              h('li', { ref: scope.measure, ...scope.attrs, tabindex: -1 }, `Row ${scope.item}`),
          },
        )
    },
  })

  wrapper = mount(Host, { attachTo: document.body })
  await nextTick()
  await nextTick()
  return wrapper
}

/**
 * Returns the indexes of the rendered rows.
 * @returns {number[]} - Indexes in DOM order
 */
const renderedIndexes = (): number[] =>
  [...document.querySelectorAll('[data-index]')].map((row) =>
    Number(row.getAttribute('data-index')),
  )

beforeEach(() => {
  layout = stubWindowLayout(ROW)
  pinned.value = null
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  layout.restore()
  document.body.innerHTML = ''
})

describe('DenseList virtualization', () => {
  it('renders only the rows of the window plus an overscan, the spacer holds all rows', async () => {
    await mountList()

    const indexes = renderedIndexes()

    expect(indexes[0]).toBe(0)
    expect(indexes.length).toBeGreaterThanOrEqual(768 / ROW)
    expect(indexes.length).toBeLessThan(50)
    expect(document.querySelector<HTMLElement>('.origin')!.style.height).toBe(`${COUNT * ROW}px`)
  })

  it('announces the size of the full list on every rendered option', async () => {
    await mountList()

    const first = document.querySelector('[data-index="0"]')!

    expect(first.getAttribute('aria-setsize')).toBe(String(COUNT))
    expect(first.getAttribute('aria-posinset')).toBe('1')
    expect(document.querySelector('[role="listbox"]')!.getAttribute('aria-multiselectable')).toBe(
      'true',
    )
  })

  it('counts the header into the row count and row indexes of a treegrid', async () => {
    await mountList('treegrid')

    expect(document.querySelector('[role="treegrid"]')!.getAttribute('aria-rowcount')).toBe(
      String(COUNT + 1),
    )
    expect(document.querySelector('[data-index="0"]')!.getAttribute('aria-rowindex')).toBe('2')
  })

  it('keeps the pinned cursor row rendered far outside the visible rows', async () => {
    await mountList()

    pinned.value = 1500
    await nextTick()
    await nextTick()

    const row = document.querySelector<HTMLElement>('[data-index="1500"]')

    expect(row).not.toBeNull()
    expect(row!.style.transform).toBe(`translateY(${1500 * ROW}px)`)
    expect(renderedIndexes()).toContain(0)
  })

  it('scrolls an unrendered row into view and resolves with its element', async () => {
    await mountList()

    expect(document.querySelector('[data-index="1200"]')).toBeNull()

    const row = await viewport.value!.reveal(1200)

    expect(layout.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 1201 * ROW - 768 }))
    expect(row?.getAttribute('data-index')).toBe('1200')
    expect(renderedIndexes()).not.toContain(0)
  })

  it('resolves with null for a key the list does not hold', async () => {
    await mountList()

    await expect(viewport.value!.reveal(COUNT + 5)).resolves.toBeNull()
  })

  it('measures the page step from the rows fully inside the window', async () => {
    await mountList()

    expect(viewport.value!.pageStep()).toBe(768 / ROW - 1)
  })

  it('keeps a focused row rendered after the cursor moved away from it', async () => {
    await mountList()

    pinned.value = 1500
    await nextTick()
    await nextTick()
    document.querySelector<HTMLElement>('[data-index="1500"]')!.focus()
    pinned.value = 3
    await nextTick()
    await nextTick()

    expect(document.activeElement?.getAttribute('data-index')).toBe('1500')
  })
})
