// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { parseFindingInfo, parseKevListed } from '#server/sources/mapping/prometheusVector.ts'

import { INFO_LABELS, vector } from './sourceSamples.ts'

const QUERY = 'sieb:trivy_finding:info'

describe('parseFindingInfo', () => {
  it('maps the info labels', () => {
    expect(parseFindingInfo(vector([INFO_LABELS]), QUERY)).toEqual([
      {
        vulnId: 'CVE-2023-28452',
        imageRef: 'index.docker.io/rancher/mirrored-coredns-coredns',
        namespace: 'kube-system',
        resourceKind: 'ReplicaSet',
        resourceName: 'coredns-7cfb7bc9c7',
        severity: 'High',
        score: 7.5,
        severitySource: 'cvss',
        exposure: 'internal',
        owner: 'platform',
      },
    ])
  })

  it('handles missing score and severity_source, odd labels and incomplete series', () => {
    const { vuln_score: _score, severity_source: _source, ...labels } = INFO_LABELS
    const [series] = parseFindingInfo(
      vector([
        { ...labels, severity: 'Unknown', exposure: 'everywhere', owner: ' team-a ' },
        { ...labels, vuln_id: '' },
      ]),
      QUERY,
    )

    expect(series).toMatchObject({
      severity: 'Unknown',
      score: null,
      severitySource: null,
      exposure: null,
      owner: 'team-a',
    })
    expect(parseFindingInfo(vector([{ ...labels, image_ref: '' }]), QUERY)).toEqual([])
  })

  it('rejects responses that are not a successful vector', () => {
    expect(() => parseFindingInfo({ status: 'error', error: 'boom' }, 'custom:q')).toThrow(
      /query custom:q did not return a vector/,
    )
  })

  it('falls back for a minimal rule that only adds image_ref to trivy_vulnerability_id', () => {
    const minimal = {
      __name__: 'trivy_vulnerability_id',
      namespace: 'shop',
      resource_kind: 'ReplicaSet',
      resource_name: 'web-5d8f',
      image_registry: 'index.docker.io',
      image_repository: 'library/nginx',
      image_ref: 'index.docker.io/library/nginx',
      vuln_id: 'CVE-2024-0001',
    }

    expect(parseFindingInfo(vector([minimal]), QUERY)).toEqual([
      {
        vulnId: 'CVE-2024-0001',
        imageRef: 'index.docker.io/library/nginx',
        namespace: 'shop',
        resourceKind: 'ReplicaSet',
        resourceName: 'web-5d8f',
        severity: 'Unknown',
        score: null,
        severitySource: null,
        exposure: null,
        owner: null,
      },
    ])
  })

  it('treats invalid owner labels as no owner and parses exposure case-insensitively', () => {
    const owners = ['a,b', 'x'.repeat(65), 'tab\there', '  ']
    const series = parseFindingInfo(
      vector(owners.map((owner) => ({ ...INFO_LABELS, owner, exposure: 'Public' }))),
      QUERY,
    )

    expect(series.map((entry) => [entry.owner, entry.exposure])).toEqual(
      owners.map(() => [null, 'public']),
    )
  })

  it('takes the trivy-operator severity and score labels as they are', () => {
    const [series] = parseFindingInfo(
      vector([{ ...INFO_LABELS, severity: 'Critical', vuln_score: '9.8' }]),
      QUERY,
    )

    expect(series).toMatchObject({ severity: 'Critical', score: 9.8 })
  })
})

describe('parseKevListed', () => {
  it('returns unique vuln ids', () => {
    const kev = vector([
      { vuln_id: 'CVE-2012-0158' },
      { vuln_id: 'CVE-2012-0158' },
      { vuln_id: 'CVE-2014-1812' },
    ])

    expect(parseKevListed(kev, 'sieb:kev:listed')).toEqual(['CVE-2012-0158', 'CVE-2014-1812'])
  })
})
