import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { buildDecision, buildFindingView } from '#core/__tests__/coreBuilders.ts'
import { fetchFindings } from '@/api/findingsApi'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { useTriageController, type TriageController } from '@/composables/useTriageController'
import { useFindingDetailStore } from '@/stores/findingDetailStore'
import { useFindingsStore } from '@/stores/findingsStore'

vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<typeof fetchFindings>(),
  fetchFindingDetail: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))

let controller: TriageController
let mounted: RoutedMount | null = null

const Host = defineComponent({
  setup: () => {
    controller = useTriageController(() => {})

    return () =>
      h('div', [
        h('a', { href: '/cves', id: 'link' }, 'By CVE'),
        h('input', { id: 'search' }),
        h('div', { 'data-shortcut-scope': 'panel' }, [h('button', { id: 'radio' }, 'Accepted')]),
      ])
  },
})

/**
 * Presses a key on an element, as the browser dispatches it to the window.
 * @param {string} key - KeyboardEvent key
 * @param {Element} target - Focused element
 * @param {KeyboardEventInit} init - Modifiers and repeat flag
 * @returns {Promise<KeyboardEvent>} - Dispatched event, after navigation settled
 */
const press = async (
  key: string,
  target: Element = document.body,
  init: KeyboardEventInit = {},
): Promise<KeyboardEvent> => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })

  target.dispatchEvent(event)
  await flushPromises()
  return event
}

const checked = (): number[] => [...controller.checkedIds.value].sort()

/**
 * Renders a focusable list row per finding, as the triage list does, jsdom lacks scrollIntoView.
 * @param {number[]} ids - Finding ids
 * @returns {HTMLElement[]} - Row elements in order
 */
const renderRows = (ids: number[]): HTMLElement[] =>
  ids.map((id) => {
    const row = document.createElement('li')

    row.setAttribute('role', 'option')
    row.setAttribute('data-finding-id', String(id))
    row.tabIndex = 0
    row.scrollIntoView = vi.fn<HTMLElement['scrollIntoView']>()
    document.body.append(row)
    return row
  })

/**
 * Presses the pointer on a row as the browser does, which moves focus to the row.
 * @param {HTMLElement} row - Pressed row
 * @returns {void}
 */
const pressRow = (row: HTMLElement): void => {
  row.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
  row.focus()
}

beforeEach(() => {
  vi.mocked(fetchFindings).mockResolvedValue([
    buildFindingView({ id: 1, imageRef: 'index.docker.io/library/nginx' }),
    buildFindingView({ id: 2, imageRef: 'index.docker.io/library/redis' }),
    buildFindingView({ id: 3, imageRef: 'index.docker.io/library/postgres' }),
  ])
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  document.body.innerHTML = ''
})

/**
 * Mounts the triage host at a path and waits for the findings.
 * @param {string} path - Path with query string
 * @returns {Promise<RoutedMount>} - Wrapper and router
 */
const mountTriage = async (path: string): Promise<RoutedMount> => {
  mounted = await mountWithRouter(Host, path)
  await flushPromises()
  return mounted
}

describe('useTriageController', () => {
  it('leaves Enter on a link or button to the control', async () => {
    const { router } = await mountTriage('/triage')

    await press('Enter', document.getElementById('link')!)
    expect(router.currentRoute.value.query.finding).toBeUndefined()

    await press('Enter')
    expect(router.currentRoute.value.query.finding).toBe('1')
  })

  it('hands the panel to the next row when the shown row is decided', async () => {
    const { router } = await mountTriage('/triage?finding=2')
    const store = useFindingsStore()

    expect(controller.currentId.value).toBe(2)

    const shown = store.items[1]!

    store.applyDecision(buildDecision({ vulnId: shown.vulnId, imageRef: shown.imageRef }), {
      state: 'active',
    })
    await flushPromises()

    expect(controller.currentId.value).toBe(3)
    expect(router.currentRoute.value.query.finding).toBe('3')
  })

  it('moves panel and cursor together with j, once per key', async () => {
    const { router } = await mountTriage('/triage?finding=1')
    const replace = vi.spyOn(router, 'replace')

    await press('j')

    expect(controller.currentId.value).toBe(2)
    expect(router.currentRoute.value.query.finding).toBe('2')
    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('keeps j, k and Escape from discarding an unsaved draft in the panel', async () => {
    const { router } = await mountTriage('/triage?finding=1')

    useFindingDetailStore().setDraftDirty(true)
    await press('j', document.getElementById('radio')!)
    await press('Escape')

    expect(controller.currentId.value).toBe(1)
    expect(router.currentRoute.value.query.finding).toBe('1')
  })

  it('puts the cursor back on the panel row when a guard cancels a row click', async () => {
    const { router } = await mountTriage('/triage?finding=1')
    const removeGuard = router.beforeEach(() => false)

    controller.select(3)
    await flushPromises()

    expect(router.currentRoute.value.query.finding).toBe('1')
    expect(controller.currentId.value).toBe(1)

    removeGuard()
    controller.select(3)
    await flushPromises()

    expect(router.currentRoute.value.query.finding).toBe('3')
    expect(controller.currentId.value).toBe(3)
  })

  it('orders rows and j by the sort in the URL', async () => {
    await mountTriage('/triage?sort=image&dir=asc')

    expect(controller.findings.value.map((finding) => finding.id)).toEqual([1, 3, 2])
    expect(controller.currentId.value).toBe(1)

    await press('j')

    expect(controller.currentId.value).toBe(3)
  })

  it('falls back to the triage order for an unknown sort', async () => {
    await mountTriage('/triage?sort=bogus&dir=asc')

    expect(controller.sort.sort.value).toBeNull()
    expect(controller.findings.value.map((finding) => finding.id)).toEqual([1, 2, 3])
  })

  it('keeps the cursor on the same finding when the sort changes', async () => {
    const { router } = await mountTriage('/triage?finding=2')

    await controller.sort.toggle('image')
    await flushPromises()

    expect(router.currentRoute.value.query).toMatchObject({ sort: 'image', dir: 'asc' })
    expect(controller.findings.value.map((finding) => finding.id)).toEqual([1, 3, 2])
    expect(controller.currentId.value).toBe(2)

    await controller.sort.toggle('image')
    await flushPromises()

    expect(controller.findings.value.map((finding) => finding.id)).toEqual([2, 3, 1])
    expect(controller.currentId.value).toBe(2)

    await press('j')

    expect(controller.currentId.value).toBe(3)

    await controller.sort.toggle('image')
    await flushPromises()

    expect(router.currentRoute.value.query.sort).toBeUndefined()
    expect(controller.findings.value.map((finding) => finding.id)).toEqual([1, 2, 3])
    expect(controller.currentId.value).toBe(3)
  })

  it('extends the checked range with Shift and arrows and shrinks it when turning back', async () => {
    await mountTriage('/triage')

    await press('ArrowDown', document.body, { shiftKey: true })
    await press('ArrowDown', document.body, { shiftKey: true })
    expect(checked()).toEqual([1, 2, 3])

    await press('ArrowUp', document.body, { shiftKey: true })
    expect(checked()).toEqual([1, 2])
    expect(controller.currentId.value).toBe(2)

    await press('ArrowDown')
    expect(controller.currentId.value).toBe(3)
    expect(checked()).toEqual([1, 2])
  })

  it('extends to the ends with Shift+Home and Shift+End, Home and End only move', async () => {
    await mountTriage('/triage')

    await press('End')
    expect(controller.currentId.value).toBe(3)
    expect(checked()).toEqual([])

    await press('Home', document.body, { shiftKey: true })
    expect(checked()).toEqual([1, 2, 3])
  })

  it('closes the panel on Escape before it clears the checked rows', async () => {
    const { router } = await mountTriage('/triage?finding=1')

    await press(' ')
    expect(checked()).toEqual([1])

    await press('Escape')
    expect(router.currentRoute.value.query.finding).toBeUndefined()
    expect(checked()).toEqual([1])

    await press('Escape')
    expect(checked()).toEqual([])
  })

  it('toggles the cursor row with Space and x, but leaves Space to a focused control', async () => {
    await mountTriage('/triage')

    await press(' ', document.getElementById('link')!)
    expect(checked()).toEqual([])

    await press(' ')
    await press('j')
    await press('x')
    expect(checked()).toEqual([1, 2])
  })

  it('checks every row with the select-all chord outside text entries only', async () => {
    await mountTriage('/triage')

    const typed = await press('a', document.getElementById('search')!, { ctrlKey: true })
    expect(typed.defaultPrevented).toBe(false)
    expect(checked()).toEqual([])

    const chord = await press('a', document.body, { ctrlKey: true })
    expect(chord.defaultPrevented).toBe(true)
    expect(checked()).toEqual([1, 2, 3])
  })

  it('leaves browser chords such as reload alone', async () => {
    await mountTriage('/triage')

    const reload = await press('r', document.body, { ctrlKey: true })
    const find = await press('f', document.body, { metaKey: true })

    expect(reload.defaultPrevented).toBe(false)
    expect(find.defaultPrevented).toBe(false)
  })

  it('keeps moving while an arrow is held, but does not repeat a toggle', async () => {
    await mountTriage('/triage')

    await press('ArrowDown', document.body, { repeat: true })
    await press('x', document.body, { repeat: true })

    expect(controller.currentId.value).toBe(2)
    expect(checked()).toEqual([])
  })

  it.each([
    ['n', 'not_affected'],
    ['a', 'accepted'],
    ['f', 'fix_planned'],
  ] as const)('opens the bulk dialog on %s for exactly the checked rows', async (key, status) => {
    const { router } = await mountTriage('/triage')
    const requestDecision = vi.spyOn(useFindingDetailStore(), 'requestDecision')

    await press('ArrowDown', document.body, { shiftKey: true })
    await press('j')
    await press('x')
    expect(checked()).toEqual([1, 2, 3])
    await press(' ')
    expect(checked()).toEqual([1, 2])

    await press(key)

    expect(controller.bulkOpen.value).toBe(true)
    expect(controller.bulkStatus.value).toBe(status)
    expect(controller.bulkTargets.value).toEqual([
      {
        vulnId: 'CVE-2025-1000',
        imageRefs: ['index.docker.io/library/nginx', 'index.docker.io/library/redis'],
      },
    ])
    expect(requestDecision).not.toHaveBeenCalled()
    expect(router.currentRoute.value.query.finding).toBeUndefined()
  })

  it('opens the panel form of the cursor row on n without checked rows', async () => {
    const { router } = await mountTriage('/triage')
    const detail = useFindingDetailStore()

    await press('j')
    await press('n')

    expect(controller.bulkOpen.value).toBe(false)
    expect(router.currentRoute.value.query.finding).toBe('2')
    expect(detail.decisionRequest).toMatchObject({ findingId: 2, status: 'not_affected' })
  })

  it('opens the bulk dialog on Shift+A without a preselected status', async () => {
    await mountTriage('/triage')

    await press('x')
    await press('n')
    controller.bulkOpen.value = false
    await press('A', document.body, { shiftKey: true })

    expect(controller.bulkOpen.value).toBe(true)
    expect(controller.bulkStatus.value).toBeNull()
  })

  it('ranges a Shift click and toggles a Ctrl click without opening the panel', async () => {
    const { router } = await mountTriage('/triage')

    controller.select(3, new MouseEvent('click', { shiftKey: true }))
    await flushPromises()
    expect(checked()).toEqual([1, 2, 3])
    expect(router.currentRoute.value.query.finding).toBeUndefined()

    controller.select(2, new MouseEvent('click', { ctrlKey: true }))
    await flushPromises()
    expect(checked()).toEqual([1, 3])
    expect(controller.currentId.value).toBe(2)

    controller.select(1, new MouseEvent('click'))
    await flushPromises()
    expect(router.currentRoute.value.query.finding).toBe('1')
    expect(checked()).toEqual([1, 3])
  })

  it('ranges a Shift click on a checkbox from the last checkbox, leaving the panel alone', async () => {
    const { router } = await mountTriage('/triage?finding=1')

    controller.toggleChecked(2, new MouseEvent('click', { metaKey: true, ctrlKey: true }))
    await flushPromises()
    expect(checked()).toEqual([2])
    expect(controller.currentId.value).toBe(1)
    expect(router.currentRoute.value.query.finding).toBe('1')

    controller.toggleChecked(3, new MouseEvent('click', { shiftKey: true }))
    await flushPromises()
    expect(checked()).toEqual([2, 3])
    expect(controller.currentId.value).toBe(3)

    controller.toggleChecked(3, new MouseEvent('click'))
    await flushPromises()
    expect(checked()).toEqual([2])
  })

  it('returns focus to the cursor row after a checkbox click on another row', async () => {
    await mountTriage('/triage')
    const rows = renderRows([1, 2, 3])

    rows[0]!.focus()
    pressRow(rows[2]!)
    controller.toggleChecked(3, new MouseEvent('click'))
    await flushPromises()
    expect(checked()).toEqual([3])
    expect(controller.currentId.value).toBe(1)
    expect(document.activeElement).toBe(rows[0])

    pressRow(rows[1]!)
    controller.toggleChecked(2, new MouseEvent('click', { metaKey: true, ctrlKey: true }))
    await flushPromises()
    expect(checked()).toEqual([2, 3])
    expect(document.activeElement).toBe(rows[0])
  })

  it('leaves focus alone after a checkbox click when no list row held focus', async () => {
    const { wrapper } = await mountTriage('/triage')
    const rows = renderRows([1, 2, 3])

    wrapper.get<HTMLInputElement>('#search').element.focus()
    pressRow(rows[2]!)
    controller.toggleChecked(3, new MouseEvent('click'))
    await flushPromises()
    expect(checked()).toEqual([3])
    expect(document.activeElement).toBe(rows[2])
  })

  it('moves focus with the cursor on a Shift click on a checkbox', async () => {
    await mountTriage('/triage')
    const rows = renderRows([1, 2, 3])

    rows[0]!.focus()
    pressRow(rows[2]!)
    controller.toggleChecked(3, new MouseEvent('click', { shiftKey: true }))
    await flushPromises()
    expect(checked()).toEqual([1, 2, 3])
    expect(controller.currentId.value).toBe(3)
    expect(document.activeElement).toBe(rows[2])
  })
})
