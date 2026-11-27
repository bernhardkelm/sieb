import { flushPromises, type DOMWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { FindingView } from '#core/findingView.ts'
import { fetchDecisions } from '@/api/decisionsApi'
import { fetchFindings, markFindingsSeen } from '@/api/findingsApi'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { useFindingSeenStore } from '@/stores/findingSeenStore'
import { useFindingsStore } from '@/stores/findingsStore'
import TriageView from '@/views/TriageView.vue'

vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<typeof fetchFindings>(),
  fetchFindingDetail: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
  markFindingsSeen: vi.fn<typeof markFindingsSeen>(async () => ({ ignored: [] })),
}))
vi.mock('@/api/decisionsApi', () => ({
  fetchDecisions: vi.fn<typeof fetchDecisions>(async () => []),
}))
vi.mock('@/api/labelsApi', () => ({
  fetchLabels: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))

const DAY_MS = 24 * 60 * 60 * 1000

let mounted: RoutedMount | null = null

/**
 * Mounts the triage view over a recent unseen, a recent seen and an older finding of
 * CVE-2025-1000 plus a recent unseen one of CVE-2025-2000.
 * @returns {Promise<RoutedMount>} - Mounted view once the findings are loaded
 */
const mountTriage = async (): Promise<RoutedMount> => {
  const recent = new Date(Date.now() - DAY_MS).toISOString()
  const findings: FindingView[] = [
    buildFindingView({ id: 1, firstSeen: recent, seen: false }),
    buildFindingView({ id: 2, firstSeen: recent, seen: true }),
    buildFindingView({ id: 3, firstSeen: new Date(Date.now() - 10 * DAY_MS).toISOString() }),
    buildFindingView({ id: 4, vulnId: 'CVE-2025-2000', firstSeen: recent, seen: false }),
  ]

  vi.mocked(fetchFindings).mockResolvedValue(findings)
  mounted = await mountWithRouter(TriageView, '/triage')
  await useFindingsStore().refresh()
  await flushPromises()
  return mounted
}

/**
 * Returns the ids of the rows that carry the new dot.
 * @returns {string[]} - Finding ids
 */
const taggedIds = (): string[] =>
  mounted!.wrapper
    .findAll('[data-finding-id]')
    .filter((row) => row.find('.title .new-dot').exists())
    .map((row) => row.attributes('data-finding-id')!)

/**
 * Returns the button that marks every listed new finding seen.
 * @returns {DOMWrapper<HTMLButtonElement> | undefined} - Button, undefined when hidden
 */
const markAllButton = (): DOMWrapper<HTMLButtonElement> | undefined =>
  mounted!.wrapper.findAll('button').find((button) => button.text() === 'Mark all as seen')

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  HTMLElement.prototype.scrollIntoView = vi.fn<HTMLElement['scrollIntoView']>()
  vi.mocked(markFindingsSeen).mockClear()
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  document.body.innerHTML = ''
})

describe('TriageView new findings', () => {
  it('tags and counts only recent findings the user has not seen', async () => {
    const { wrapper } = await mountTriage()

    expect(taggedIds().sort()).toEqual(['1', '4'])
    expect(wrapper.text()).toContain('2 new this week')
  })

  it('marks the filtered new findings seen at once and sends them', async () => {
    const { wrapper } = await mountTriage()

    useFindingsStore().setFilters({ q: 'CVE-2025-2000' })
    await flushPromises()
    await markAllButton()!.trigger('click')

    expect(taggedIds()).toEqual([])
    expect(markAllButton()).toBeUndefined()
    expect(wrapper.text()).not.toContain('new this week')

    await useFindingSeenStore().flush()
    expect(markFindingsSeen).toHaveBeenCalledExactlyOnceWith([4])

    useFindingsStore().setFilters({ q: '' })
    await flushPromises()
    expect(taggedIds()).toEqual(['1'])
    expect(wrapper.text()).toContain('1 new this week')
  })

  it('hides the action while nothing listed is new', async () => {
    await mountTriage()

    useFindingsStore().setFilters({ q: 'CVE-2099' })
    await flushPromises()

    expect(markAllButton()).toBeUndefined()
  })
})
