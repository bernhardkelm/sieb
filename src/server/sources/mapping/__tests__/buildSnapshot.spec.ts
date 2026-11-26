// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { buildSnapshot, parseSourceData } from '#server/sources/mapping/buildSnapshot.ts'

import { INFO_LABELS, reportList, vector, VULNERABILITY } from './sourceSamples.ts'

const FETCHED_AT = '2026-06-01T00:00:00.000Z'
const QUERIES = { findings: 'custom:findings', kev: 'custom:kev' }

describe('buildSnapshot', () => {
  it('joins one instance per matching report package, Prometheus wins for severity', () => {
    const parsed = parseSourceData(
      {
        findingInfo: vector([INFO_LABELS]),
        vulnerabilityReports: reportList([
          VULNERABILITY,
          { ...VULNERABILITY, resource: 'golang.org/x/net', installedVersion: 'v0.1.0' },
          { ...VULNERABILITY, vulnerabilityID: 'CVE-2099-1' },
        ]),
        kevListed: vector([{ vuln_id: 'CVE-2023-28452' }]),
      },
      QUERIES,
    )
    const snapshot = buildSnapshot(parsed, FETCHED_AT, QUERIES)

    expect(snapshot.kevIds).toEqual(['CVE-2023-28452'])
    expect(snapshot.fetchedAt).toBe(FETCHED_AT)
    expect(
      snapshot.instances.map((instance) => [instance.package, instance.severity, instance.score]),
    ).toEqual([
      ['github.com/coredns/coredns', 'High', 7.5],
      ['golang.org/x/net', 'High', 7.5],
    ])
  })

  it('keeps a series without report rows as an instance with null details', () => {
    const parsed = parseSourceData(
      {
        findingInfo: vector([INFO_LABELS]),
        vulnerabilityReports: reportList([]),
        kevListed: vector([{ vuln_id: 'CVE-2021-44228' }]),
      },
      QUERIES,
    )

    expect(buildSnapshot(parsed, FETCHED_AT, QUERIES).instances).toMatchObject([
      { vulnId: 'CVE-2023-28452', container: null, package: null, fixedVersion: null },
    ])
  })

  it('fails when the info result is empty but reports list vulnerabilities', () => {
    const parsed = parseSourceData(
      {
        findingInfo: vector([]),
        vulnerabilityReports: reportList([VULNERABILITY]),
        kevListed: vector([{ vuln_id: 'CVE-2021-44228' }]),
      },
      QUERIES,
    )

    expect(() => buildSnapshot(parsed, FETCHED_AT, QUERIES)).toThrow(/^custom:findings is empty/)
  })

  it('fails on an empty KEV list instead of reporting every finding as not KEV listed', () => {
    const parsed = parseSourceData(
      {
        findingInfo: vector([INFO_LABELS]),
        vulnerabilityReports: reportList([VULNERABILITY]),
        kevListed: vector([]),
      },
      QUERIES,
    )

    expect(() => buildSnapshot(parsed, FETCHED_AT, QUERIES)).toThrow(
      /^custom:kev is empty, the KEV feed is broken/,
    )
  })

  it('leaves the KEV list out without a KEV query', () => {
    const queries = { ...QUERIES, kev: null }
    const parsed = parseSourceData(
      { findingInfo: vector([INFO_LABELS]), vulnerabilityReports: reportList([VULNERABILITY]) },
      queries,
    )

    expect(buildSnapshot(parsed, FETCHED_AT, queries).kevIds).toBeNull()
  })
})
