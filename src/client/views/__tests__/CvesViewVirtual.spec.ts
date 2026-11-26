import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { CveAggregate } from '#core/cveAggregation.ts'
import { fetchCves } from '@/api/cvesApi'
import { fetchFindings } from '@/api/findingsApi'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { stubWindowLayout, type WindowLayout } from '@/__tests__/windowLayout'
import { findingRowKey, groupRowKey } from '@/keyboard/rowKey'
import CvesView from '@/views/CvesView.vue'

vi.mock('@/api/cvesApi', () => ({
  fetchCves: vi.fn<typeof fetchCves>(),
}))
vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<typeof fetchFindings>(),
  fetchFindingDetail: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))
vi.mock('@/api/labelsApi', () => ({
  fetchLabels: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))

const FINDINGS = 1500
const BIG = 'CVE-2025-1000'

let layout: WindowLayout
let mounted: RoutedMount | null = null

/**
 * Builds an undecided CVE.
 * @param {string} vulnId - Vuln id
 * @param {number} openCount - Open findings
 * @returns {CveAggregate} - Aggregate
 */
const cve = (vulnId: string, openCount: number): CveAggregate => ({
  vulnId,
  title: 'openssl: something',
  primaryLink: null,
  kev: false,
  maxSeverity: 'High',
  maxScore: 7.5,
  maxExposure: 'public',
  imageCount: openCount,
  imageRefs: [],
  openCount,
  inboxCount: openCount,
  decisionStates: {
    undecided: openCount,
    active: 0,
    fix_planned: 0,
    expired: 0,
    reopened: 0,
    revoked: 0,
  },
  allScopeDecision: null,
  allScopeEffective: null,
})

/**
 * Presses a key on the focused element, as the browser dispatches it to the window.
 * @param {string} key - KeyboardEvent key
 * @returns {Promise<void>} - Resolves once the cursor settled and the row is focused
 */
const press = async (key: string): Promise<void> => {
  const target = document.activeElement ?? document.body

  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  await flushPromises()
}

const focusedKey = (): string | null => document.activeElement?.getAttribute('data-row-key') ?? null

beforeEach(async () => {
  layout = stubWindowLayout(32)
  vi.mocked(fetchCves).mockResolvedValue([cve(BIG, FINDINGS), cve('CVE-2025-2000', 1)])
  vi.mocked(fetchFindings).mockResolvedValue(
    Array.from({ length: FINDINGS }, (_, index) =>
      buildFindingView({ id: index + 1, imageRef: `registry.example.com/acme/app-${index}` }),
    ),
  )
  mounted = await mountWithRouter(CvesView, `/cves?cve=${BIG}`)
  await flushPromises()
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  layout.restore()
  document.body.innerHTML = ''
})

describe('CvesView with a large expanded group', () => {
  it('flattens the group into virtualized rows and counts every row', () => {
    const grid = document.querySelector('[role="treegrid"]')!

    expect(grid.getAttribute('aria-rowcount')).toBe(String(1 + 2 + 1 + FINDINGS))
    expect(document.querySelectorAll('[data-row-key^="finding:"]').length).toBeLessThan(60)
  })

  it('walks into, through and out of the nested rows with the arrows, j and End', async () => {
    expect(focusedKey()).toBe(groupRowKey(BIG))

    await press('ArrowRight')
    expect(focusedKey()).toBe(findingRowKey(1))

    await press('j')
    expect(focusedKey()).toBe(findingRowKey(2))

    await press('End')
    expect(focusedKey()).toBe(groupRowKey('CVE-2025-2000'))

    await press('k')
    expect(focusedKey()).toBe(findingRowKey(FINDINGS))
    expect(layout.scrollY()).toBeGreaterThan(FINDINGS * 32 - 1000)

    await press('ArrowLeft')
    expect(focusedKey()).toBe(groupRowKey(BIG))
    expect(layout.scrollY()).toBeLessThan(100)
  })
})
