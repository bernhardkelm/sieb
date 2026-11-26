import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { StatsResponse } from '#core/apiTypes.ts'
import type { StatsRange } from '#core/statsRange.ts'
import { mountWithRouter } from '@/__tests__/mountWithRouter'
import { buildStatsResponse } from '@/__tests__/statsBuilders'
import { fetchStats } from '@/api/statsApi'
import OverviewStats from '@/components/overview/OverviewStats.vue'
import { useFindingsStore } from '@/stores/findingsStore'
import { useLabelsStore } from '@/stores/labelsStore'

vi.mock('@/api/statsApi', () => ({
  fetchStats: vi.fn<(range?: StatsRange) => Promise<StatsResponse>>(),
}))

const HISTORY = buildStatsResponse(
  {
    open: 120,
    inbox: 40,
    kev: 3,
    public: 18,
    notAffected: 15,
    accepted: 10,
    bySeverity: { critical: 4, high: 16, medium: 60, low: 30, unknown: 10 },
  },
  [
    ['2026-06-01T12:00:00.000Z', { open: 150, inbox: 70, notAffected: 12, accepted: 8 }],
    ['2026-06-15T12:00:00.000Z', { open: 130, inbox: 50, notAffected: 14, accepted: 8 }],
  ],
)

/**
 * Waits for pending promises and renders.
 * @returns {Promise<void>} - Resolves after the queue drained
 */
const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve))
  await nextTick()
}

beforeEach(() => {
  localStorage.clear()
  vi.mocked(fetchStats).mockReset()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('OverviewStats', () => {
  it('renders every panel with value, delta and an accessible trend', async () => {
    vi.mocked(fetchStats).mockResolvedValue(HISTORY)
    const { wrapper } = await mountWithRouter(OverviewStats, '/triage')

    useLabelsStore().data = { exposure: true, owners: [], kev: 'cisa' }
    expect(wrapper.get('[role="status"]').text()).toBe('Loading stats…')
    await flush()

    const panels = wrapper.findAll('.stat-panel')
    const open = panels[0]!

    expect(panels.map((panel) => panel.get('.label').text())).toEqual([
      'Open',
      'Triage',
      'KEV',
      'Crit + High',
      'Public',
      'Not affected',
      'Accepted',
    ])
    expect(panels.map((panel) => panel.classes('wide'))).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ])
    expect(open.get('.value').text()).toBe('120')
    expect(open.get('.delta').text()).toBe('−30')
    expect(open.get('.delta').classes()).toContain('good')
    expect(open.get('[role="img"]').attributes('aria-label')).toBe(
      'Trend down 30 over 30 days, from 150 to 120',
    )
    expect(wrapper.get('.bar').attributes('aria-label')).toBe(
      'Severity mix: Critical 4 (3%), High 16 (13%), Medium 60 (50%), Low 30 (25%), Unknown 10 (8%)',
    )
    wrapper.unmount()
  })

  it('shows values without sparklines while there is no history', async () => {
    vi.mocked(fetchStats).mockResolvedValue(buildStatsResponse({ open: 7 }))
    const { wrapper } = await mountWithRouter(OverviewStats, '/triage')

    await flush()

    expect(wrapper.get('.stat-panel .value').text()).toBe('7')
    expect(wrapper.find('.stat-sparkline').exists()).toBe(false)
    expect(wrapper.text()).toContain('No history yet')
    wrapper.unmount()
  })

  it('opens Triage filtered to critical and high from its panel', async () => {
    vi.mocked(fetchStats).mockResolvedValue(HISTORY)
    const { wrapper, router } = await mountWithRouter(OverviewStats, '/decisions')
    const findings = useFindingsStore()

    findings.setFilters({ q: 'nginx' })
    await flush()
    await wrapper.findAll('.stat-panel')[3]!.trigger('click')
    await flush()

    expect(router.currentRoute.value.name).toBe('triage')
    expect(findings.filters.severity).toEqual(['Critical', 'High'])
    expect(findings.filters.q).toBe('')
    expect(wrapper.findAll('.stat-panel')[2]!.element.tagName).toBe('A')
    wrapper.unmount()
  })

  it('opens Triage filtered to KEV from its panel', async () => {
    vi.mocked(fetchStats).mockResolvedValue(HISTORY)
    const { wrapper, router } = await mountWithRouter(OverviewStats, '/decisions')
    const findings = useFindingsStore()

    findings.setFilters({ q: 'nginx' })
    await flush()
    await wrapper.findAll('.stat-panel')[2]!.trigger('click')
    await flush()

    expect(router.currentRoute.value.name).toBe('triage')
    expect(findings.filters.kev).toBe(true)
    expect(findings.filters.q).toBe('')
    wrapper.unmount()
  })

  it('refetches with the selected range', async () => {
    vi.mocked(fetchStats).mockResolvedValue(HISTORY)
    const { wrapper } = await mountWithRouter(OverviewStats, '/triage')

    await flush()
    await wrapper.get('[aria-label="Last 7 days"]').trigger('click')
    await flush()

    expect(fetchStats).toHaveBeenLastCalledWith('7d')
    expect(wrapper.get('[aria-label="Last 7 days"]').attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })

  it('leaves out the Public panel while no open finding has an exposure label', async () => {
    vi.mocked(fetchStats).mockResolvedValue(HISTORY)
    const { wrapper } = await mountWithRouter(OverviewStats, '/triage')

    useLabelsStore().data = { exposure: false, owners: ['self'], kev: 'cisa' }
    await flush()

    expect(wrapper.findAll('.stat-panel .label').map((label) => label.text())).toEqual([
      'Open',
      'Triage',
      'KEV',
      'Crit + High',
      'Not affected',
      'Accepted',
    ])
    expect(wrapper.findAll('.stat-panel.wide')).toHaveLength(0)
    wrapper.unmount()
  })

  it('offers a retry when the first load fails', async () => {
    vi.mocked(fetchStats).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(HISTORY)
    const { wrapper } = await mountWithRouter(OverviewStats, '/triage')

    useLabelsStore().data = { exposure: true, owners: [], kev: 'cisa' }
    await flush()
    expect(wrapper.get('[role="alert"]').text()).toContain('Stats unavailable')

    await wrapper.get('[role="alert"] button').trigger('click')
    await flush()

    expect(wrapper.findAll('.stat-panel')).toHaveLength(7)
    wrapper.unmount()
  })

  it('leaves out the KEV panel for the KEV source none', async () => {
    vi.mocked(fetchStats).mockResolvedValue(HISTORY)
    const { wrapper } = await mountWithRouter(OverviewStats, '/triage')

    useLabelsStore().data = { exposure: true, owners: [], kev: 'none' }
    await flush()

    expect(wrapper.findAll('.stat-panel .label').map((label) => label.text())).not.toContain('KEV')
    wrapper.unmount()
  })
})
