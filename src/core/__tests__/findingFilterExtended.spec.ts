import { describe, expect, it } from 'vitest'

import { filterFindings } from '#core/findingFilter.ts'
import { groupFindings } from '#core/findingGroups.ts'
import { parseFindingQuery, type FindingQuery } from '#core/findingQuery.ts'

import { buildDecision, buildFindingView } from './coreBuilders.ts'

const BASE: FindingQuery = {
  view: 'all',
  includeResolved: false,
  q: null,
  severity: [],
  exposure: [],
  owner: [],
  newSince: null,
  kev: false,
}

const AUTHENTIK = 'ghcr.io/goauthentik/server'

const findings = [
  buildFindingView({
    id: 1,
    vulnId: 'CVE-2024-1234',
    imageRef: AUTHENTIK,
    severity: 'Critical',
    score: 9.8,
    kev: true,
    exposure: 'public',
    packages: ['libssl3', 'openssl'],
    namespaces: ['authentik'],
    workloads: ['authentik/ReplicaSet/authentik-server-6d4f'],
  }),
  buildFindingView({
    id: 2,
    vulnId: 'CVE-2024-12345',
    severity: 'High',
    score: 7.1,
    fixable: false,
    effective: { state: 'active' },
    decision: buildDecision({ status: 'not_affected' }),
    inInbox: false,
  }),
  buildFindingView({
    id: 3,
    vulnId: 'CVE-2025-0001',
    imageRef: AUTHENTIK,
    severity: 'Medium',
    score: null,
    packages: ['zlib'],
    namespaces: ['authentik'],
    workloads: ['authentik/StatefulSet/authentik-redis'],
    effective: { state: 'fix_planned' },
    decision: buildDecision({ status: 'fix_planned' }),
    inInbox: false,
  }),
  buildFindingView({
    id: 4,
    vulnId: 'CVE-2025-0002',
    severity: 'High',
    score: 8,
    kev: true,
    effective: { state: 'expired', expiresAt: '2026-05-01T00:00:00.000Z' },
    decision: buildDecision({ status: 'accepted' }),
  }),
]

const KEV_DATES = new Map([
  ['CVE-2024-1234', '2026-05-20'],
  ['CVE-2025-0002', '2026-05-30'],
])

/**
 * Returns the ids a query keeps.
 * @param {Partial<FindingQuery>} query - Query overrides
 * @param {ReadonlyMap<string, string> | null} kevDatesAdded - KEV dates, null without catalog
 * @returns {number[]} - Finding ids
 */
const ids = (
  query: Partial<FindingQuery>,
  kevDatesAdded: ReadonlyMap<string, string> | null = KEV_DATES,
): number[] =>
  filterFindings(findings, { ...BASE, ...query }, { kevDatesAdded }).map((finding) => finding.id)

describe('filterFindings name patterns', () => {
  it('matches exact names case-insensitively and prefixes with a trailing star', () => {
    expect(ids({ vulnIds: ['cve-2024-1234'] })).toEqual([1])
    expect(ids({ vulnIds: ['CVE-2024-1234*'] })).toEqual([1, 2])
    expect(ids({ packages: ['OpenSSL'] })).toEqual([1])
    expect(ids({ packages: ['lib*'] })).toEqual([1, 2, 4])
    expect(ids({ namespaces: ['authentik'] })).toEqual([1, 3])
  })

  it('ignores image tags and digests and matches workloads by full name, namespace/name or name', () => {
    expect(ids({ images: [`${AUTHENTIK}:2024.8@sha256:abc`] })).toEqual([1, 3])
    expect(ids({ images: ['ghcr.io/*'] })).toEqual([1, 3])
    expect(ids({ workloads: ['authentik/StatefulSet/authentik-redis'] })).toEqual([3])
    expect(ids({ workloads: ['authentik/authentik-redis'] })).toEqual([3])
    expect(ids({ workloads: ['authentik-server*'] })).toEqual([1])
  })
})

describe('filterFindings facts', () => {
  it('filters by minimum score, dropping findings without one', () => {
    expect(ids({ minScore: 8 })).toEqual([1, 4])
    expect(ids({ minScore: 0 })).toEqual([1, 2, 4])
  })

  it('filters by fixable', () => {
    expect(ids({ fixable: true })).toEqual([1, 3, 4])
    expect(ids({ fixable: false })).toEqual([2])
  })

  it('filters by decision state, active covering not_affected and accepted', () => {
    expect(ids({ decisionState: ['undecided'] })).toEqual([1])
    expect(ids({ decisionState: ['active'] })).toEqual([2])
    expect(ids({ decisionState: ['not_affected'] })).toEqual([2])
    expect(ids({ decisionState: ['accepted'] })).toEqual([])
    expect(ids({ decisionState: ['fix_planned', 'expired'] })).toEqual([3, 4])
    expect(ids({ decisionState: ['reopened'] })).toEqual([])
  })

  it('filters by KEV date added and ignores it without the catalog', () => {
    expect(ids({ kevAddedSince: '2026-05-25' })).toEqual([4])
    expect(ids({ kevAddedSince: '2026-05-20' })).toEqual([1, 4])
    expect(ids({ kevAddedSince: '2026-05-25' }, null)).toEqual([1, 2, 3, 4])
  })

  it('combines filters', () => {
    expect(ids({ namespaces: ['authentik'], severity: ['Critical'], kev: true })).toEqual([1])
    expect(ids({ images: [AUTHENTIK], decisionState: ['undecided', 'fix_planned'] })).toEqual([
      1, 3,
    ])
    expect(ids({ packages: ['openssl', 'zlib'], minScore: 5, fixable: true })).toEqual([1])
    expect(ids({ q: 'authentik', decisionState: ['active'] })).toEqual([])
  })
})

describe('parseFindingQuery new parameters', () => {
  it('parses name lists, score, decision state, KEV date and fixable', () => {
    const parsed = parseFindingQuery({
      vulnIds: 'CVE-2024-1234, CVE-2025-*',
      namespaces: 'authentik',
      minScore: '7.5',
      decisionState: 'undecided,reopened',
      kevAddedSince: '2026-05-20T10:00:00Z',
      fixable: 'false',
    })

    expect(parsed.ok && parsed.value).toMatchObject({
      vulnIds: ['CVE-2024-1234', 'CVE-2025-*'],
      namespaces: ['authentik'],
      packages: [],
      minScore: 7.5,
      decisionState: ['undecided', 'reopened'],
      kevAddedSince: '2026-05-20',
      fixable: false,
    })
  })

  it('rejects invalid values', () => {
    expect(
      parseFindingQuery({
        minScore: '11',
        decisionState: 'maybe',
        fixable: 'yes',
        kevAddedSince: 'x',
      }),
    ).toEqual({
      ok: false,
      errors: [
        { field: 'minScore', code: 'invalid' },
        { field: 'decisionState', code: 'invalid' },
        { field: 'kevAddedSince', code: 'invalid' },
        { field: 'fixable', code: 'invalid' },
      ],
    })
  })
})

describe('groupFindings', () => {
  it('counts per CVE and image with the highest severity, most severe group first', () => {
    expect(groupFindings(findings, 'image')).toEqual([
      {
        key: AUTHENTIK,
        count: 2,
        maxSeverity: 'Critical',
        kevCount: 1,
        inboxCount: 1,
        imageCount: 1,
        vulnCount: 2,
      },
      {
        key: 'index.docker.io/library/nginx',
        count: 2,
        maxSeverity: 'High',
        kevCount: 1,
        inboxCount: 1,
        imageCount: 1,
        vulnCount: 2,
      },
    ])
    expect(groupFindings(findings, 'cve').map((group) => group.key)).toEqual([
      'CVE-2024-1234',
      'CVE-2024-12345',
      'CVE-2025-0002',
      'CVE-2025-0001',
    ])
  })

  it('counts a finding in every namespace and package it has', () => {
    const packages = groupFindings(findings, 'package')

    expect(packages.map((group) => [group.key, group.count])).toEqual([
      ['libssl3', 3],
      ['openssl', 1],
      ['zlib', 1],
    ])
    expect(groupFindings(findings, 'namespace').map((group) => [group.key, group.count])).toEqual([
      ['authentik', 2],
      ['shop', 2],
    ])
  })
})
