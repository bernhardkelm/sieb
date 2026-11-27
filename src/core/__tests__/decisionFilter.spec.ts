import { describe, expect, it } from 'vitest'

import { isDecisionFilter, isExpiring, matchesDecisionFilter } from '#core/decisionFilter.ts'

import { buildDecision, NOW } from './coreBuilders.ts'
import { DAY_MS } from '#core/timeUnits.ts'

/**
 * Builds an active decision view expiring after some days.
 * @param {number | null} days - Days until expiry, null for none
 * @returns {Parameters<typeof isExpiring>[0]} - Decision with state
 */
const activeIn = (days: number | null): Parameters<typeof isExpiring>[0] => ({
  decision: buildDecision({
    expiresAt: days === null ? null : new Date(NOW.getTime() + days * DAY_MS).toISOString(),
  }),
  effective: { state: 'active' },
})

describe('decision filters', () => {
  it('treats active decisions expiring within 14 days as expiring', () => {
    expect(isExpiring(activeIn(14), NOW)).toBe(true)
    expect(isExpiring(activeIn(15), NOW)).toBe(false)
    expect(isExpiring(activeIn(null), NOW)).toBe(false)
    expect(isExpiring({ ...activeIn(3), effective: { state: 'fix_planned' } }, NOW)).toBe(false)
  })

  it('matches states and expiring', () => {
    expect(matchesDecisionFilter(activeIn(3), 'expiring', NOW)).toBe(true)
    expect(matchesDecisionFilter(activeIn(3), 'active', NOW)).toBe(true)
    expect(matchesDecisionFilter(activeIn(3), 'reopened', NOW)).toBe(false)
    expect(isDecisionFilter('fix_planned')).toBe(true)
    expect(isDecisionFilter('soon')).toBe(false)
  })
})
