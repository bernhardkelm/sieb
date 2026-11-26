import { describe, expect, it } from 'vitest'

import { NOW, buildDecision, buildFindingView } from '#core/__tests__/coreBuilders.ts'
import { countExpiringDecisions } from '@/components/triage/expiringDecisions'

const SOON = '2026-06-10T00:00:00.000Z'
const LATER = '2026-08-01T00:00:00.000Z'

describe('countExpiringDecisions', () => {
  it('counts each active decision expiring within 14 days once', () => {
    const shared = buildDecision({ id: 1, scope: 'all', expiresAt: SOON })
    const findings = [
      buildFindingView({ id: 1, decision: shared, effective: { state: 'active' } }),
      buildFindingView({ id: 2, decision: shared, effective: { state: 'active' } }),
      buildFindingView({
        id: 3,
        decision: buildDecision({ id: 2, expiresAt: LATER }),
        effective: { state: 'active' },
      }),
      buildFindingView({
        id: 4,
        decision: buildDecision({ id: 3, expiresAt: SOON }),
        effective: { state: 'revoked', revokedAt: SOON },
      }),
      buildFindingView({ id: 5 }),
    ]

    expect(countExpiringDecisions(findings, NOW)).toBe(1)
  })
})
