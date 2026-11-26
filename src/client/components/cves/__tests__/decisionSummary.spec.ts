import { describe, expect, it } from 'vitest'

import { buildDecision, buildFindingView } from '#core/__tests__/coreBuilders.ts'
import { summarizeDecisions } from '@/components/cves/decisionSummary'
import { reopenedEffective } from '@/__tests__/reopenedEffective'

const accepted = buildDecision({ status: 'accepted' })
const notAffected = buildDecision({ status: 'not_affected' })

describe('summarizeDecisions', () => {
  it('counts open findings per status of their active decision, undecided last', () => {
    const summary = summarizeDecisions([
      buildFindingView(),
      buildFindingView({ decision: accepted, effective: { state: 'active' } }),
      buildFindingView({ decision: notAffected, effective: { state: 'active' } }),
      buildFindingView({ decision: accepted, effective: { state: 'active' } }),
    ])

    expect(summary).toBe('2 accepted, 1 not affected, 1 undecided')
  })

  it('names lapsed decisions by their state and skips resolved findings', () => {
    const summary = summarizeDecisions([
      buildFindingView({
        decision: accepted,
        effective: reopenedEffective({ reason: 'kev_listed', severity: 'High', kev: true }),
      }),
      buildFindingView({ decision: accepted, effective: { state: 'active' }, resolvedAt: 'x' }),
    ])

    expect(summary).toBe('1 re-opened')
  })

  it('is empty without open findings', () => {
    expect(summarizeDecisions([])).toBe('')
  })
})
