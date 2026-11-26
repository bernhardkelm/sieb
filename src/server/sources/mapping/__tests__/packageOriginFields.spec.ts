// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { parsePackageOrigin } from '#server/sources/mapping/packageOriginFields.ts'

describe('parsePackageOrigin', () => {
  it('keeps every field null or empty when the entry has none of them', () => {
    expect(parsePackageOrigin({ vulnerabilityID: 'CVE-2099-1', target: '' })).toEqual({
      locations: [],
      packageType: null,
      packageClass: null,
      purl: null,
    })
  })

  it('keeps a target without pkgPath, as Trivy writes for lockfiles and OS packages', () => {
    expect(parsePackageOrigin({ target: 'app/package-lock.json' }).locations).toEqual([
      { target: 'app/package-lock.json', pkgPath: null },
    ])
  })

  it('falls back to pkgIdentifier.PURL and purl, and requires the pkg: scheme', () => {
    expect(parsePackageOrigin({ pkgIdentifier: { PURL: 'pkg:npm/express@4.19.2' } }).purl).toBe(
      'pkg:npm/express@4.19.2',
    )
    expect(parsePackageOrigin({ purl: 'pkg:pypi/requests@2.31.0' }).purl).toBe(
      'pkg:pypi/requests@2.31.0',
    )
    expect(
      parsePackageOrigin({ packagePURL: 'https://example.com', purl: 'pkg:npm/a@1' }).purl,
    ).toBe('pkg:npm/a@1')
    expect(parsePackageOrigin({ packagePURL: 'javascript:alert(1)' }).purl).toBeNull()
  })

  it('drops values that are not plain strings or exceed their length cap', () => {
    const parsed = parsePackageOrigin({
      target: 'usr/bin/\u0007bell',
      pkgPath: 'a/'.repeat(600),
      packageType: { name: 'gobinary' },
      class: 'x'.repeat(65),
      packagePURL: `pkg:npm/${'a'.repeat(600)}@1`,
    })

    expect(parsed).toEqual({ locations: [], packageType: null, packageClass: null, purl: null })
    expect(parsePackageOrigin({ target: 'usr/bin/‮evil' }).locations).toEqual([])
  })
})
