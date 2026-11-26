import { describe, expect, it } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { FindingView } from '#core/findingView.ts'
import { sortInbox } from '@/components/inbox/inboxSort'

const FINDINGS: FindingView[] = [
  buildFindingView({ id: 1, kev: true, severity: 'Medium', score: 5, exposure: 'internal' }),
  buildFindingView({ id: 2, severity: 'Critical', score: 9.1, exposure: 'public', title: 'zlib' }),
  buildFindingView({ id: 3, severity: 'Critical', score: 9.8, exposure: 'internal' }),
  buildFindingView({
    id: 4,
    severity: 'High',
    score: null,
    exposure: 'gated',
    title: 'openssl',
    owner: 'self',
    firstSeen: '2026-05-30T00:00:00.000Z',
  }),
]

/**
 * Returns the ids of findings in order.
 * @param {readonly FindingView[]} findings - Findings
 * @returns {number[]} - Ids
 */
const ids = (findings: readonly FindingView[]): number[] => findings.map((finding) => finding.id)

describe('sortInbox', () => {
  it('keeps the triage order by default', () => {
    expect(ids(sortInbox(FINDINGS, null))).toEqual([1, 2, 3, 4])
  })

  it('sorts severity by rank, then score', () => {
    expect(ids(sortInbox(FINDINGS, { column: 'severity', direction: 'desc' }))).toEqual([
      3, 2, 4, 1,
    ])
    expect(ids(sortInbox(FINDINGS, { column: 'severity', direction: 'asc' }))).toEqual([1, 4, 2, 3])
  })

  it('breaks ties in triage order, so KEV ties fall back to exposure', () => {
    expect(ids(sortInbox(FINDINGS, { column: 'kev', direction: 'desc' }))).toEqual([1, 2, 4, 3])
  })

  it('sorts titles with missing titles last in both directions', () => {
    expect(ids(sortInbox(FINDINGS, { column: 'title', direction: 'asc' }))).toEqual([4, 2, 1, 3])
    expect(ids(sortInbox(FINDINGS, { column: 'title', direction: 'desc' }))).toEqual([2, 4, 1, 3])
  })

  it('sorts exposure, owner and first seen', () => {
    expect(ids(sortInbox(FINDINGS, { column: 'exposure', direction: 'desc' }))[0]).toBe(2)
    expect(ids(sortInbox(FINDINGS, { column: 'owner', direction: 'asc' }))[0]).toBe(4)
    expect(ids(sortInbox(FINDINGS, { column: 'firstSeen', direction: 'desc' }))[0]).toBe(4)
  })
})

describe('sortInbox label columns', () => {
  const findings = [
    buildFindingView({ id: 1, owner: 'third-party', exposure: 'internal' }),
    buildFindingView({ id: 2, owner: null, exposure: null }),
    buildFindingView({ id: 3, owner: 'self', exposure: 'gated' }),
    buildFindingView({ id: 4, owner: 'platform', exposure: 'public' }),
  ]

  it('sorts free-form owners self first, alphabetically, none last in both directions', () => {
    expect(ids(sortInbox(findings, { column: 'owner', direction: 'asc' }))).toEqual([3, 4, 1, 2])
    expect(ids(sortInbox(findings, { column: 'owner', direction: 'desc' }))).toEqual([1, 4, 3, 2])
  })

  it('ranks unknown exposure between gated and internal', () => {
    expect(ids(sortInbox(findings, { column: 'exposure', direction: 'desc' }))).toEqual([
      4, 3, 2, 1,
    ])
  })
})
