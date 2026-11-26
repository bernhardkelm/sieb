import { describe, expect, it } from 'vitest'

import { buildDecision } from '#core/__tests__/coreBuilders.ts'
import { searchDecisions } from '@/components/decisions/decisionSearch'

describe('searchDecisions', () => {
  it('matches the justification label', () => {
    const views = [
      { decision: buildDecision({ id: 1, justification: 'component_not_present' }) },
      { decision: buildDecision({ id: 2 }) },
    ]

    expect(searchDecisions(views, 'false positive').map((view) => view.decision.id)).toEqual([1])
    expect(searchDecisions(views, 'not reachable')).toHaveLength(2)
  })
})
