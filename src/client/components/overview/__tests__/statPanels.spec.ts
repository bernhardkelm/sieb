import { describe, expect, it } from 'vitest'

import { buildStatsResponse } from '@/__tests__/statsBuilders'
import { buildStatPanels, type StatPanelModel } from '@/components/overview/statPanels'
import type { StatPanelKey } from '@/components/overview/statPanelSpecs'

const FETCHED_AT = Date.parse('2026-06-30T12:00:00.000Z')

/**
 * Picks one panel by key.
 * @param {StatPanelModel[]} panels - Panels
 * @param {StatPanelKey} key - Panel key
 * @returns {StatPanelModel} - Panel
 */
const pick = (panels: StatPanelModel[], key: StatPanelKey): StatPanelModel =>
  panels.find((candidate) => candidate.key === key)!

describe('buildStatPanels', () => {
  it('shows values without delta or trend while there is no history', () => {
    const panels = buildStatPanels(buildStatsResponse({ open: 1284, inbox: 3 }), FETCHED_AT, '30d')
    const open = pick(panels, 'open')

    expect(open.valueText).toBe('1,284')
    expect(open.deltaText).toBeNull()
    expect(open.points).toEqual([])
    expect(open.trendLabel).toBeNull()
  })

  it('compares the live value with the first snapshot and ends the trend with it', () => {
    const response = buildStatsResponse({ open: 1211, accepted: 9 }, [
      ['2026-06-01T12:00:00.000Z', { open: 1284, accepted: 4 }],
      ['2026-06-20T12:00:00.000Z', { open: 1250, accepted: 6 }],
    ])
    const panels = buildStatPanels(response, FETCHED_AT, '30d')
    const open = pick(panels, 'open')
    const accepted = pick(panels, 'accepted')

    expect(open.deltaText).toBe('−73')
    expect(open.tone).toBe('good')
    expect(open.points.map((point) => point.value)).toEqual([1284, 1250, 1211])
    expect(open.points.at(-1)?.time).toBe(FETCHED_AT)
    expect(open.trendLabel).toBe('Trend down 73 over 30 days, from 1,284 to 1,211')
    expect(accepted.deltaText).toBe('+5')
    expect(accepted.tone).toBe('neutral')
  })

  it('shows not affected and accepted apart and leaves snapshots without them out of their trend', () => {
    const response = buildStatsResponse({ open: 30, notAffected: 7, accepted: 3 }, [
      ['2026-06-01T12:00:00.000Z', { open: 40, notAffected: null, accepted: null }],
      ['2026-06-20T12:00:00.000Z', { open: 35, notAffected: 5, accepted: 1 }],
    ])
    const panels = buildStatPanels(response, FETCHED_AT, '30d')
    const notAffected = pick(panels, 'notAffected')
    const accepted = pick(panels, 'accepted')

    expect([notAffected.label, notAffected.valueText]).toEqual(['Not affected', '7'])
    expect(notAffected.points.map((point) => point.value)).toEqual([5, 7])
    expect(notAffected.deltaText).toBe('+2')
    expect([accepted.label, accepted.valueText, accepted.deltaText]).toEqual([
      'Accepted',
      '3',
      '+2',
    ])
    expect(pick(panels, 'open').points).toHaveLength(3)
  })

  it('sums critical and high and keeps the primary panels first', () => {
    const response = buildStatsResponse({
      bySeverity: { critical: 2, high: 5, medium: 9, low: 0, unknown: 1 },
    })
    const panels = buildStatPanels(response, FETCHED_AT, '7d')

    expect(pick(panels, 'criticalHigh').valueText).toBe('7')
    expect(panels.map((panel) => panel.primary)).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
      false,
    ])
  })
})
