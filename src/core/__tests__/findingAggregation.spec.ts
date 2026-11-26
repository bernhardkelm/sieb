import { describe, expect, it } from 'vitest'

import { aggregateFinding, groupByFinding } from '#core/findingAggregation.ts'

import { buildSourceInstance } from './coreBuilders.ts'

describe('groupByFinding', () => {
  it('groups rows by vuln_id and image_ref', () => {
    const groups = groupByFinding([
      buildSourceInstance({ resourceName: 'a' }),
      buildSourceInstance({ imageRef: 'quay.io/x/y' }),
      buildSourceInstance({ resourceName: 'b' }),
    ])

    expect(groups.map((group) => [group.imageRef, group.instances.length])).toEqual([
      ['index.docker.io/library/nginx', 2],
      ['quay.io/x/y', 1],
    ])
  })
})

describe('aggregateFinding', () => {
  it('keeps unknown exposure above internal and no owner when no instance has one', () => {
    const fields = aggregateFinding(
      [
        buildSourceInstance({ exposure: 'internal', owner: null }),
        buildSourceInstance({ exposure: null, owner: null }),
      ],
      new Set(),
    )

    expect(fields).toMatchObject({ exposure: null, owner: null })
  })

  it('takes the maximum severity, score and exposure and the first owner by rank', () => {
    const fields = aggregateFinding(
      [
        buildSourceInstance({
          severity: 'Medium',
          score: 9.1,
          exposure: 'gated',
          owner: 'platform',
        }),
        buildSourceInstance({
          severity: 'Critical',
          score: null,
          severitySource: 'cvss',
          owner: 'self',
          title: 'overflow',
          primaryLink: 'https://example.test/cve',
        }),
      ],
      new Set(),
    )

    expect(fields).toEqual({
      severity: 'Critical',
      score: 9.1,
      severitySource: 'cvss',
      kev: false,
      exposure: 'gated',
      owner: 'self',
      title: 'overflow',
      primaryLink: 'https://example.test/cve',
    })
  })

  it('marks KEV from the KEV list and keeps a missing score null', () => {
    const fields = aggregateFinding(
      [buildSourceInstance({ severity: 'Unknown', score: null })],
      new Set(['CVE-2025-1000']),
    )

    expect(fields.kev).toBe(true)
    expect(fields.score).toBeNull()
    expect(fields.severity).toBe('Unknown')
  })

  it('ignores the severity source of lower rated rows', () => {
    const fields = aggregateFinding(
      [
        buildSourceInstance({ severity: 'Low', severitySource: 'cvss' }),
        buildSourceInstance({ severity: 'High' }),
      ],
      new Set(),
    )

    expect(fields.severitySource).toBeNull()
  })
})
