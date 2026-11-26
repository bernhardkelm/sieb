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
  it('is private only for own images, also on a public registry', () => {
    expect(sourceAccess('ghcr.io/acme/api', 'self', DEFAULT_PUBLIC_REGISTRIES)).toBe('private')
    expect(sourceAccess('registry.example.com/acme/api', 'self', [])).toBe('private')
  })

  it('is public for images of a listed registry with another owner', () => {
    expect(sourceAccess('index.docker.io/library/nginx', null, DEFAULT_PUBLIC_REGISTRIES)).toBe(
      'public',
    )
    expect(sourceAccess('nginx', 'third-party', DEFAULT_PUBLIC_REGISTRIES)).toBe('public')
    expect(
      sourceAccess('mirror.gcr.io/aquasec/trivy', 'third-party', DEFAULT_PUBLIC_REGISTRIES),
    ).toBe('public')
    expect(sourceAccess('cgr.dev/chainguard/static', null, DEFAULT_PUBLIC_REGISTRIES)).toBe(
      'public',
    )
  })

  it('is unknown for other registries and refs without a registry', () => {
    expect(
      sourceAccess('registry.example.com/acme/api', 'platform', DEFAULT_PUBLIC_REGISTRIES),
    ).toBe('unknown')
    expect(sourceAccess('registry.gitlab.com/acme/api', null, DEFAULT_PUBLIC_REGISTRIES)).toBe(
      'unknown',
    )
    expect(sourceAccess('nginx', null, ['quay.io'])).toBe('unknown')
    expect(sourceAccess('', null, DEFAULT_PUBLIC_REGISTRIES)).toBe('unknown')
  })
})
