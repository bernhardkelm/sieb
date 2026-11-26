import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TriageSelectionBar from '@/components/triage/TriageSelectionBar.vue'
import type { HintActionId } from '@/keyboard/hintActions'
import { useHintActionsStore } from '@/stores/hintActionsStore'

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

/**
 * Mounts the bar with fresh hint actions.
 * @param {number} count - Checked rows
 * @returns {VueWrapper} - Bar wrapper
 */
const mountBar = (count: number): VueWrapper => {
  const pinia = createPinia()

  setActivePinia(pinia)
  wrapper = mount(TriageSelectionBar, {
    props: { count },
    global: { plugins: [pinia] },
    attachTo: document.body,
  })
  return wrapper
}

/**
 * Returns the button of the bar with a label.
 * @param {VueWrapper} bar - Bar wrapper
 * @param {string} label - Button text
 * @returns {HTMLButtonElement} - Button
 */
const buttonOf = (bar: VueWrapper, label: string): HTMLButtonElement =>
  bar.findAll('button').find((button) => button.text() === label)!.element as HTMLButtonElement

describe('TriageSelectionBar', () => {
  it('shows only with checked rows', async () => {
    const bar = mountBar(0)

    expect(bar.find('[role="toolbar"]').exists()).toBe(false)

    await bar.setProps({ count: 2 })

    const toolbar = bar.get('[role="toolbar"]')

    expect(toolbar.text()).toContain('2 selected')
    expect(toolbar.attributes('aria-label')).toContain('2 selected')
  })

  it.each([
    ['Accept', 'accept'],
    ['Not affected', 'notAffected'],
    ['Fix planned', 'fixPlanned'],
    ['Select all', 'selectAll'],
  ] as const)('runs %s as its key does, without refocusing the list', async (label, id) => {
    const bar = mountBar(2)
    const hints = useHintActionsStore()
    const ran: HintActionId[] = []
    const refocus = vi.fn<() => Promise<void>>(async () => {})

    hints.register({
      actions: Object.fromEntries(
        (['accept', 'notAffected', 'fixPlanned', 'selectAll'] as const).map((action) => [
          action,
          { run: () => ran.push(action) },
        ]),
      ),
      refocus,
    })

    buttonOf(bar, label).click()
    await vi.waitFor(() => expect(ran).toEqual([id]))
    expect(refocus).not.toHaveBeenCalled()
  })

  it('emits clear', async () => {
    const bar = mountBar(1)

    buttonOf(bar, 'Clear').click()

    expect(bar.emitted('clear')).toHaveLength(1)
  })

  it('marks blocked actions as disabled', () => {
    const bar = mountBar(1)

    expect(buttonOf(bar, 'Accept').getAttribute('aria-disabled')).toBe('true')
    expect(buttonOf(bar, 'Clear').hasAttribute('aria-disabled')).toBe(false)
  })

  it('moves focus between the buttons with the arrow keys', async () => {
    const bar = mountBar(1)
    const accept = buttonOf(bar, 'Accept')

    accept.focus()
    await bar.get('[role="toolbar"]').trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(buttonOf(bar, 'Not affected'))

    buttonOf(bar, 'Select all').focus()
    await bar.get('[role="toolbar"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(buttonOf(bar, 'Fix planned'))
  })
})
