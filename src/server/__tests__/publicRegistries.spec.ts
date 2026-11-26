// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_PUBLIC_REGISTRIES } from '#core/sourceAccess.ts'
import { readConfig } from '#server/config.ts'

describe('SIEB_PUBLIC_REGISTRIES', () => {
  it('defaults to the public registries list', () => {
    expect(readConfig({}, '/srv/sieb').publicRegistries).toEqual(DEFAULT_PUBLIC_REGISTRIES)
    expect(readConfig({ SIEB_PUBLIC_REGISTRIES: ' , ' }, '/srv/sieb').publicRegistries).toEqual(
      DEFAULT_PUBLIC_REGISTRIES,
    )
  })

  it('reads a comma list of lower-cased hosts with optional ports', () => {
    expect(
      readConfig(
        { SIEB_PUBLIC_REGISTRIES: 'GHCR.io, mirror.example.com:5000,ghcr.io' },
        '/srv/sieb',
      ).publicRegistries,
    ).toEqual(['ghcr.io', 'mirror.example.com:5000'])
  })

  it('refuses entries that are not registry hosts', () => {
    expect(() => readConfig({ SIEB_PUBLIC_REGISTRIES: 'https://ghcr.io' }, '/srv/sieb')).toThrow(
      'SIEB_PUBLIC_REGISTRIES',
    )
  })
})
