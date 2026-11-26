import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import { fetchFindings } from '@/api/findingsApi'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { useTriageController, type TriageController } from '@/composables/useTriageController'
import { useFindingDetailStore } from '@/stores/findingDetailStore'
import { useHintActionsStore } from '@/stores/hintActionsStore'

vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<typeof fetchFindings>(),
  fetchFindingDetail: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))

let controller: TriageController
let mounted: RoutedMount | null = null
const focusSearch = vi.fn<() => void>()

const Host = defineComponent({
  setup: () => {
    controller = useTriageController(focusSearch)

    return () => h('button', { id: 'hint' }, 'Accept')
  },
})

/**
 * Mounts the triage host on findings with the given ids, with a focusable row per finding.
 * @param {number[]} ids - Finding ids
 * @returns {Promise<RoutedMount>} - Wrapper and router
 */
const mountTriage = async (ids: number[]): Promise<RoutedMount> => {
  vi.mocked(fetchFindings).mockResolvedValue(
    ids.map((id) => buildFindingView({ id, imageRef: `index.docker.io/library/image-${id}` })),
  )
  mounted = await mountWithRouter(Host, '/triage')
  await flushPromises()

  for (const id of ids) {
    const row = document.createElement('li')

    row.setAttribute('role', 'option')
    row.setAttribute('data-finding-id', String(id))
    row.tabIndex = 0
    row.scrollIntoView = vi.fn<HTMLElement['scrollIntoView']>()
    document.body.append(row)
  }

  return mounted
}

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  document.body.innerHTML = ''
  focusSearch.mockClear()
})

describe('useTriageHintActions', () => {
  it('opens the bulk dialog with the status for the checked rows', async () => {
    await mountTriage([1, 2, 3])
    const hints = useHintActionsStore()

    controller.toggleChecked(1)
    controller.toggleChecked(2)

    expect(await hints.run('accept')).toBe(true)
    expect(controller.bulkOpen.value).toBe(true)
    expect(controller.bulkStatus.value).toBe('accepted')
    expect(controller.bulkTargets.value[0]?.imageRefs).toHaveLength(2)
  })

  it('opens the panel form of the cursor row without checked rows and focuses it', async () => {
    const { router } = await mountTriage([1, 2, 3])
    const hints = useHintActionsStore()

    document.getElementById('hint')!.focus()
    await hints.run('fixPlanned')
    await flushPromises()

    expect(controller.bulkOpen.value).toBe(false)
    expect(router.currentRoute.value.query.finding).toBe('1')
    expect(useFindingDetailStore().decisionRequest).toMatchObject({
      findingId: 1,
      status: 'fix_planned',
    })
    expect(document.activeElement?.getAttribute('data-finding-id')).toBe('1')
  })

  it('toggles the cursor row, checks all rows and focuses search', async () => {
    await mountTriage([1, 2, 3])
    const hints = useHintActionsStore()

    await hints.run('toggle')
    expect([...controller.checkedIds.value]).toEqual([1])

    await hints.run('selectAll')
    expect([...controller.checkedIds.value].sort()).toEqual([1, 2, 3])

    await hints.run('search')
    expect(focusSearch).toHaveBeenCalledOnce()
  })

  it('blocks the row actions on an empty triage list', async () => {
    await mountTriage([])
    const hints = useHintActionsStore()

    expect(hints.reasonOf('accept')).toBe('No finding under the cursor')
    expect(hints.reasonOf('toggle')).toBe('No finding under the cursor')
    expect(hints.reasonOf('selectAll')).toBe('No findings listed')
    expect(hints.reasonOf('search')).toBeNull()
  })
})
