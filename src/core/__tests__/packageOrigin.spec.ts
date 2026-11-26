import { describe, expect, it } from 'vitest'

import { buildSourceInstance } from '#core/__tests__/coreBuilders.ts'
import { mergeDuplicateInstances } from '#core/mergeDuplicateInstances.ts'
import { MAX_LOCATIONS, mergeLocations, packageOrigins } from '#core/packageOrigin.ts'

describe('packageOrigins', () => {
  it('merges paths per package version, pkgPath before target, a type before a class', () => {
    const origins = packageOrigins([
      buildSourceInstance({
        package: 'requests',
        installedVersion: '2.31.0',
        locations: [{ target: 'Python', pkgPath: 'usr/lib/requests/METADATA' }],
        packageClass: 'lang-pkgs',
      }),
      buildSourceInstance({
        package: 'requests',
        installedVersion: '2.31.0',
        resourceName: 'other',
        locations: [
          { target: 'Python', pkgPath: 'usr/lib/requests/METADATA' },
          { target: 'app/poetry.lock', pkgPath: null },
        ],
        packageType: 'python-pkg',
        purl: 'pkg:pypi/requests@2.31.0',
      }),
      buildSourceInstance({ package: 'zlib' }),
    ])

    expect(origins).toEqual([
      {
        package: 'requests',
        installedVersion: '2.31.0',
        packageType: 'python-pkg',
        purl: 'pkg:pypi/requests@2.31.0',
        paths: ['usr/lib/requests/METADATA', 'app/poetry.lock'],
      },
    ])
  })

  it('falls back to the class and returns nothing when no instance names an origin', () => {
    expect(packageOrigins([buildSourceInstance({ packageClass: 'os-pkgs' })])).toMatchObject([
      { package: 'libssl3', packageType: 'os-pkgs', purl: null, paths: [] },
    ])
    expect(packageOrigins([buildSourceInstance()])).toEqual([])
  })
})

describe('mergeLocations', () => {
  it('drops duplicates and caps the list', () => {
    const many = Array.from({ length: MAX_LOCATIONS + 5 }, (_, index) => ({
      target: `bin/${index}`,
      pkgPath: null,
    }))

    expect(mergeLocations([many, many])).toHaveLength(MAX_LOCATIONS)
    expect(
      mergeLocations([[{ target: 'a', pkgPath: null }], [{ target: 'a', pkgPath: null }]]),
    ).toEqual([{ target: 'a', pkgPath: null }])
  })
})

describe('mergeDuplicateInstances', () => {
  it('keeps the first row per instance key and merges the locations of the others', () => {
    const merged = mergeDuplicateInstances([
      buildSourceInstance({ imageTag: 'a', locations: [{ target: 'bin/x', pkgPath: null }] }),
      buildSourceInstance({ package: 'zlib' }),
      buildSourceInstance({
        imageTag: 'b',
        locations: [{ target: 'bin/y', pkgPath: null }],
        purl: 'pkg:golang/stdlib@v1',
      }),
    ])

    expect(merged).toHaveLength(2)
    expect(merged[0]).toMatchObject({
      imageTag: 'a',
      purl: 'pkg:golang/stdlib@v1',
      locations: [
        { target: 'bin/x', pkgPath: null },
        { target: 'bin/y', pkgPath: null },
      ],
    })
  })
})
