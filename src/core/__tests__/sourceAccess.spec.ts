import { describe, expect, it } from 'vitest'

import { DEFAULT_PUBLIC_REGISTRIES, registryOf, sourceAccess } from '#core/sourceAccess.ts'

describe('registryOf', () => {
  it('reads the registry host like Docker, Docker Hub when implicit', () => {
    expect(registryOf('ghcr.io/goauthentik/server')).toBe('ghcr.io')
    expect(registryOf('Registry.Example.com:5000/acme/api')).toBe('registry.example.com:5000')
    expect(registryOf('localhost/acme/api')).toBe('localhost')
    expect(registryOf('library/nginx')).toBe('docker.io')
    expect(registryOf('nginx')).toBe('docker.io')
    expect(registryOf(' ')).toBeNull()
  })
})

describe('sourceAccess', () => {
  it('is public for public registries and private for own images and other registries', () => {
    expect(sourceAccess('index.docker.io/library/nginx', null, DEFAULT_PUBLIC_REGISTRIES)).toBe(
      'public',
    )
    expect(sourceAccess('ghcr.io/acme/api', 'self', DEFAULT_PUBLIC_REGISTRIES)).toBe('private')
    expect(
      sourceAccess('registry.example.com/acme/api', 'platform', DEFAULT_PUBLIC_REGISTRIES),
    ).toBe('private')
    expect(sourceAccess('nginx', 'third-party', DEFAULT_PUBLIC_REGISTRIES)).toBe('public')
    expect(sourceAccess('nginx', null, ['quay.io'])).toBe('private')
    expect(sourceAccess('', null, DEFAULT_PUBLIC_REGISTRIES)).toBe('unknown')
  })
})
