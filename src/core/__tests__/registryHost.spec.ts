import { describe, expect, it } from 'vitest'

import { registryOf } from '#core/registryHost.ts'

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
