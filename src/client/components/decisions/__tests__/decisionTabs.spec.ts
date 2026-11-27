import { describe, expect, it } from 'vitest'

import { buildDecision, NOW } from '#core/__tests__/coreBuilders.ts'
import type { EffectiveDecision } from '#core/effectiveDecision.ts'
import { reopenedEffective } from '@/__tests__/reopenedEffective'
import {
  countDecisionTabs,
  decisionsInTab,
  parseDecisionTab,
} from '@/components/decisions/decisionTabs'

/**
 * Builds a decision with its state.
 * @param {number} id - Decision id
 * @param {EffectiveDecision} effective - State
 * @param {string | null} expiresAt - Expiry
 * @returns {{ decision: ReturnType<typeof buildDecision>, effective: EffectiveDecision }} - Decision view
 */
const view = (id: number, effective: EffectiveDecision, expiresAt: string | null = null) => ({
  decision: buildDecision({ id, expiresAt }),
  effective,
})

const VIEWS = [
  view(1, { state: 'active' }),
  view(2, { state: 'active' }, '2026-06-05T00:00:00.000Z'),
  view(3, reopenedEffective()),
  view(4, { state: 'revoked', revokedAt: '2026-05-20T00:00:00.000Z' }),
  view(5, { state: 'fix_planned' }),
]

describe('decisionTabs', () => {
  it('reads the tab from the query, active for unknown values', () => {
    expect(parseDecisionTab('reopened')).toBe('reopened')
    expect(parseDecisionTab('bogus')).toBe('active')
    expect(parseDecisionTab(null)).toBe('active')
  })

  it('counts every tab, expiring decisions under active as well', () => {
    expect(countDecisionTabs(VIEWS, NOW)).toEqual({
      active: 2,
      expiring: 1,
      reopened: 1,
      expired: 0,
      fix_planned: 1,
      upstream_pending: 0,
      revoked: 1,
    })
  })

  it('lists the decisions of a tab in their order', () => {
    expect(decisionsInTab(VIEWS, 'active', NOW).map((item) => item.decision.id)).toEqual([1, 2])
    expect(decisionsInTab(VIEWS, 'expiring', NOW).map((item) => item.decision.id)).toEqual([2])
  })
})
