import { describe, expect, it } from 'vitest'

import { buildDecision } from '#core/__tests__/coreBuilders.ts'
import type { DecisionView } from '#core/findingView.ts'
import { sortDecisions } from '@/components/decisions/decisionSort'

const VIEWS: DecisionView[] = [
  {
    decision: buildDecision({
      id: 1,
      createdBy: 'zoe',
      createdAt: '2026-05-20T00:00:00.000Z',
      expiresAt: '2026-07-01T00:00:00.000Z',
    }),
    effective: { state: 'active' },
    openFindings: 1,
  },
  {
    decision: buildDecision({
      id: 2,
      scope: 'all',
      imageRef: null,
      createdBy: 'ada',
      createdAt: '2026-05-10T00:00:00.000Z',
    }),
    effective: { state: 'expired', expiresAt: '2026-05-30T00:00:00.000Z' },
    openFindings: 6,
  },
  {
    decision: buildDecision({
      id: 3,
      imageRef: 'index.docker.io/library/alpine',
      createdAt: '2026-05-25T00:00:00.000Z',
      expiresAt: '2026-06-10T00:00:00.000Z',
    }),
    effective: { state: 'fix_planned' },
    openFindings: 0,
  },
]

/**
 * Returns the decision ids of views in order.
 * @param {readonly DecisionView[]} views - Decisions
 * @returns {number[]} - Ids
 */
const ids = (views: readonly DecisionView[]): number[] => views.map((view) => view.decision.id)

describe('sortDecisions', () => {
  it('keeps the API order by default', () => {
    expect(ids(sortDecisions(VIEWS, null))).toEqual([1, 2, 3])
  })

  it('sorts states by the attention they need', () => {
    expect(ids(sortDecisions(VIEWS, { column: 'state', direction: 'asc' }))).toEqual([2, 1, 3])
  })

  it('sorts scope all before image names, by the short name', () => {
    expect(ids(sortDecisions(VIEWS, { column: 'scope', direction: 'asc' }))).toEqual([2, 3, 1])
  })

  it('puts decisions that never expire last in both directions', () => {
    expect(ids(sortDecisions(VIEWS, { column: 'expiresAt', direction: 'asc' }))).toEqual([3, 1, 2])
    expect(ids(sortDecisions(VIEWS, { column: 'expiresAt', direction: 'desc' }))).toEqual([1, 3, 2])
  })

  it('sorts author, creation date and open findings', () => {
    expect(ids(sortDecisions(VIEWS, { column: 'createdBy', direction: 'asc' }))).toEqual([2, 3, 1])
    expect(ids(sortDecisions(VIEWS, { column: 'createdAt', direction: 'desc' }))).toEqual([3, 1, 2])
    expect(ids(sortDecisions(VIEWS, { column: 'openFindings', direction: 'desc' }))[0]).toBe(2)
  })
})
