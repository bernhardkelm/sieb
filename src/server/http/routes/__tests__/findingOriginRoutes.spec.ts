// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { FindingDetail, FindingView } from '#core/findingView.ts'

import { requestJson, syncedTestApp } from '#server/http/__tests__/appFixtures.ts'

/**
 * Reads the detail of the first mock finding in an image with a package.
 * @param {string} imageRef - Image reference
 * @param {string} pkg - Package name
 * @returns {Promise<FindingDetail>} - Detail
 */
const detailOf = async (imageRef: string, pkg: string): Promise<FindingDetail> => {
  const { app } = await syncedTestApp()
  const findings = (await requestJson<FindingView[]>(app, '/api/findings')).body
  const finding = findings.find(
    (candidate) => candidate.imageRef === imageRef && candidate.packages.includes(pkg),
  )

  return (await requestJson<FindingDetail>(app, `/api/findings/${finding?.id}`)).body
}

describe('finding detail origins', () => {
  it('lists every binary a Go package was found in, with type and PURL', async () => {
    const { instances } = await detailOf('quay.io/prometheus/prometheus', 'stdlib')

    expect(instances[0]).toMatchObject({
      package: 'stdlib',
      locations: [
        { target: 'bin/prometheus', pkgPath: null },
        { target: 'bin/promtool', pkgPath: null },
      ],
      packageType: 'gobinary',
      packageClass: 'lang-pkgs',
      purl: expect.stringMatching(/^pkg:golang\/stdlib@v1\.22\.7$/),
    })
  })

  it('carries the package file of a Python package next to its target', async () => {
    const { instances } = await detailOf('registry.example.com/acme/demo-worker', 'requests')

    expect(instances[0]?.locations).toEqual([
      {
        target: 'Python',
        pkgPath: 'usr/local/lib/python3.12/site-packages/requests-2.31.0.dist-info/METADATA',
      },
    ])
  })

  it('answers empty origins for reports without the additional Trivy fields', async () => {
    const { instances } = await detailOf('index.docker.io/library/mariadb', 'libssl3')

    expect(instances.length).toBeGreaterThan(0)
    expect(instances.every((instance) => instance.locations.length === 0)).toBe(true)
    expect(instances[0]).toMatchObject({ packageType: null, packageClass: null, purl: null })
  })
})
