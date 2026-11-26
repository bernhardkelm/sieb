import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import AppSidebar from '@/components/layout/AppSidebar.vue'
import { NOT_AVAILABLE_REASON } from '@/keyboard/hintActions'
import { ROUTE_NAMES } from '@/router/routeNames'
import { useHintActionsStore } from '@/stores/hintActionsStore'
import { useMcpStore } from '@/stores/mcpStore'

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

/**
 * Mounts the sidebar on a memory router at a path, with the overview panels stubbed.
 * @param {string} path - Starting path
 * @returns {Promise<VueWrapper>} - Sidebar wrapper
 */
const mountSidebar = async (path: string): Promise<VueWrapper> => {
  const pinia = createPinia()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: Object.values(ROUTE_NAMES).map((name) => ({
      path: `/${name}`,
      name,
      component: { render: () => null },
    })),
  })

  setActivePinia(pinia)
  await router.push(path)
  await router.isReady()

  wrapper = mount(AppSidebar, {
    global: { plugins: [pinia, router], stubs: { OverviewStats: true } },
    attachTo: document.body,
  })
  return wrapper
}

/**
 * Returns the hint entry carrying a label.
 * @param {VueWrapper} sidebar - Sidebar wrapper
 * @param {string} label - Hint label
 * @returns {Element} - Button or text entry of the hint
 */
const hintOf = (sidebar: VueWrapper, label: string): Element => {
  const entry = sidebar
    .findAll('.hints li > *')
    .find((item) => item.findAll('span').at(-1)?.text() === label)

  if (!entry) {
    throw new Error(`No hint ${label}`)
  }

  return entry.element
}

describe('AppSidebar hints', () => {
  it('lists the Claude hints at the end of the inbox only with the integration on', async () => {
    const sidebar = await mountSidebar('/inbox')
    const labels = (): string[] =>
      sidebar.findAll('.hints li > *').map((item) => item.findAll('span').at(-1)?.text() ?? '')

    expect(labels()).not.toContain('Copy for Claude')

    useMcpStore().info = { enabled: true, mcpUrl: 'https://sieb.example.com/mcp', oauth: false }
    await sidebar.vm.$nextTick()

    expect(labels().slice(-3)).toEqual(['Open in Claude', 'Copy for Claude', 'Copy claude command'])
    expect((hintOf(sidebar, 'Copy for Claude') as HTMLButtonElement).title).toBe(
      NOT_AVAILABLE_REASON,
    )

    await sidebar.vm.$router.push('/cves')

    expect(labels()).not.toContain('Copy for Claude')
  })

  it('renders actions as buttons and range and tree hints as text', async () => {
    const sidebar = await mountSidebar('/inbox')

    expect(hintOf(sidebar, 'Accept').tagName).toBe('BUTTON')
    expect(hintOf(sidebar, 'Select all').tagName).toBe('BUTTON')
    expect(hintOf(sidebar, 'Select range').tagName).toBe('SPAN')

    await sidebar.vm.$router.push('/images')

    expect(hintOf(sidebar, 'Collapse, expand').tagName).toBe('SPAN')
    expect(hintOf(sidebar, 'Search').tagName).toBe('BUTTON')
  })

  it('runs the registered action on click', async () => {
    const sidebar = await mountSidebar('/inbox')
    const run = vi.fn<() => void>()

    useHintActionsStore().register({ actions: { accept: { run } } })
    ;(hintOf(sidebar, 'Accept') as HTMLButtonElement).click()
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce())
  })

  it('disables a blocked action with its reason and does not run it', async () => {
    const sidebar = await mountSidebar('/decisions')
    const reopened = ref(false)
    const run = vi.fn<() => void>()

    useHintActionsStore().register({
      actions: {
        reconfirm: { run, blockedBy: () => (reopened.value ? null : 'Not re-opened') },
      },
    })
    await sidebar.vm.$nextTick()

    const button = hintOf(sidebar, 'Re-confirm') as HTMLButtonElement

    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.title).toBe('Not re-opened')

    button.click()
    await sidebar.vm.$nextTick()
    expect(run).not.toHaveBeenCalled()

    reopened.value = true
    await sidebar.vm.$nextTick()

    expect(button.hasAttribute('aria-disabled')).toBe(false)
    expect(button.title).toBe('')
  })

  it('disables actions no view registered', async () => {
    const sidebar = await mountSidebar('/cves')
    const button = hintOf(sidebar, 'Decide open images') as HTMLButtonElement

    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.title).toBe(NOT_AVAILABLE_REASON)
  })
})
