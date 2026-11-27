import { describe, expect, it } from 'vitest'

import { filterFindings } from '#core/findingFilter.ts'
import { parseFindingQuery, type FindingQuery } from '#core/findingQuery.ts'

import { buildFindingView, NOW } from './coreBuilders.ts'

const ALL: FindingQuery = {
  view: 'all',
  includeResolved: false,
  q: null,
  severity: [],
  exposure: [],
  owner: [],
  newSince: null,
  kev: false,
  vulnIds: [],
  packages: [],
  images: [],
  namespaces: [],
  workloads: [],
  minScore: null,
  decisionState: [],
  kevAddedSince: null,
  fixable: null,
  pending: [],
}

describe('parseFindingQuery', () => {
  it('parses lists, booleans and the new-since timestamp', () => {
    expect(
      parseFindingQuery({
        view: 'inbox',
        includeResolved: '1',
        q: ' libssl ',
        severity: 'Critical,High',
        exposure: 'public',
        owner: 'self',
        newSince: '2026-05-25',
        kev: 'true',
      }),
    ).toEqual({
      ok: true,
      value: {
        ...ALL,
        view: 'inbox',
        includeResolved: true,
        q: 'libssl',
        severity: ['Critical', 'High'],
        exposure: ['public'],
        owner: ['self'],
        newSince: '2026-05-25T00:00:00.000Z',
        kev: true,
      },
    })
    expect(parseFindingQuery({ view: 'inbox' })).toEqual({
      ok: true,
      value: { ...ALL, view: 'inbox' },
    })
    expect(parseFindingQuery({})).toEqual({ ok: true, value: ALL })
  })

  it('takes free-form owners as a trimmed comma list', () => {
    const parsed = parseFindingQuery({ owner: 'self, platform team ,,third-party' })

    expect(parsed.ok && parsed.value.owner).toEqual(['self', 'platform team', 'third-party'])
  })

  it('takes unknown next to the exposure labels and rejects other entries', () => {
    const parsed = parseFindingQuery({ exposure: 'gated,unknown' })

    expect(parsed.ok && parsed.value.exposure).toEqual(['gated', 'unknown'])
    expect(parseFindingQuery({ exposure: 'public,external' })).toEqual({
      ok: false,
      errors: [{ field: 'exposure', code: 'invalid' }],
    })
  })

  it('collects invalid parameters', () => {
    expect(parseFindingQuery({ owner: `self,${'x'.repeat(65)}`, newSince: 'soon' })).toEqual({
      ok: false,
      errors: [
        { field: 'newSince', code: 'invalid' },
        { field: 'owner', code: 'invalid' },
      ],
    })
  })
})

describe('filterFindings', () => {
  const findings = [
    buildFindingView({ id: 1, packages: ['libssl3'] }),
    buildFindingView({ id: 2, severity: 'Low', inInbox: false }),
    buildFindingView({ id: 3, resolvedAt: NOW.toISOString(), inInbox: false }),
    buildFindingView({ id: 4, firstSeen: NOW.toISOString(), owner: 'self', packages: ['zlib'] }),
    buildFindingView({
      id: 5,
      kev: true,
      owner: null,
      exposure: null,
      inInbox: false,
      severity: 'Low',
    }),
  ]

  /**
   * Returns the ids a query keeps.
   * @param {Partial<FindingQuery>} query - Query overrides
   * @returns {number[]} - Finding ids
   */
  const ids = (query: Partial<FindingQuery>): number[] =>
    filterFindings(findings, { ...ALL, ...query }).map((finding) => finding.id)

  it('applies the view, resolved flag and filters', () => {
    expect(ids({})).toEqual([1, 2, 4, 5])
    expect(ids({ includeResolved: true })).toEqual([1, 2, 3, 4, 5])
    expect(ids({ view: 'inbox' })).toEqual([1, 4])
    expect(ids({ severity: ['Low'] })).toEqual([2, 5])
    expect(ids({ owner: ['self'] })).toEqual([4])
    expect(ids({ exposure: ['internal'] })).toEqual([1, 2, 4])
    expect(ids({ exposure: ['unknown'] })).toEqual([5])
    expect(ids({ exposure: ['internal', 'unknown'] })).toEqual([1, 2, 4, 5])
    expect(ids({ newSince: '2026-05-25T00:00:00.000Z' })).toEqual([4])
    expect(ids({ kev: true })).toEqual([5])
    expect(ids({ q: 'ZLIB' })).toEqual([4])
    expect(ids({ q: 'nginx' })).toEqual([1, 2, 4, 5])
  })
})
