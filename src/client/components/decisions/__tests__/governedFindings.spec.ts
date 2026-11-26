import { describe, expect, it } from 'vitest'

import { buildDecision, buildFindingView, NOW } from '#core/__tests__/coreBuilders.ts'
import { decisionWhy } from '@/components/decisions/decisionWhy'
import { governedFindings } from '@/components/decisions/governedFindings'
import { reopenedEffective } from '@/__tests__/reopenedEffective'

const allScope = buildDecision({ id: 7, scope: 'all', imageRef: null })

describe('governedFindings', () => {
  it('lists the open finding of an image decision, also when it no longer governs', () => {
    const decision = buildDecision({ id: 3 })
    const findings = [
      buildFindingView({ id: 1 }),
      buildFindingView({ id: 2, imageRef: 'index.docker.io/library/redis' }),
      buildFindingView({ id: 3, resolvedAt: '2026-05-30T00:00:00.000Z' }),
    ]

    expect(governedFindings(decision, findings).map((finding) => finding.id)).toEqual([1])
  })

  it('lists the open findings an all-scope decision governs', () => {
    const findings = [
      buildFindingView({ id: 1, decision: allScope }),
      buildFindingView({ id: 2, decision: buildDecision({ id: 8 }) }),
      buildFindingView({ id: 3, vulnId: 'CVE-2025-2000', decision: allScope }),
    ]

    expect(governedFindings(allScope, findings).map((finding) => finding.id)).toEqual([1])
  })
})

describe('decisionWhy', () => {
  it('explains a re-opened decision', () => {
    const decision = buildDecision({ severityAtDecision: 'Low' })

    expect(
      decisionWhy(
        {
          decision,
          effective: reopenedEffective(),
        },
        NOW,
      ),
    ).toBe('Severity rose from Low to Critical on nginx')
    expect(
      decisionWhy(
        {
          decision,
          effective: reopenedEffective({ reason: 'kev_listed', severity: 'Low', kev: true }),
        },
        NOW,
      ),
    ).toBe('Listed in KEV on nginx, not listed when decided')
  })

  it('warns about an active decision expiring soon, nothing for later expiries', () => {
    const soon = buildDecision({ expiresAt: '2026-06-04T12:00:00.000Z' })
    const later = buildDecision({ expiresAt: '2026-09-01T00:00:00.000Z' })

    expect(decisionWhy({ decision: soon, effective: { state: 'active' } }, NOW)).toBe(
      'Expires in 3d',
    )
    expect(decisionWhy({ decision: later, effective: { state: 'active' } }, NOW)).toBeNull()
  })
})
