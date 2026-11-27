import { describe, expect, it } from 'vitest'

import {
  coveringScope,
  registryScopeFor,
  scopesCollide,
  type AccessScope,
} from '#core/accessScope.ts'
import { splitImageRef } from '#core/imageRefParts.ts'

const SCOPE: AccessScope = {
  id: 1,
  label: 'acme',
  uses: ['registry', 'git'],
  registryHost: 'ghcr.io',
  gitHost: 'github.com',
  pathPrefix: 'acme',
  repoMapping: null,
}

describe('splitImageRef', () => {
  it('splits host and path the way Docker resolves them', () => {
    expect(splitImageRef('nginx')).toEqual({ host: 'docker.io', path: 'library/nginx' })
    expect(splitImageRef('index.docker.io/library/nginx:1.27')).toEqual({
      host: 'docker.io',
      path: 'library/nginx',
    })
    expect(splitImageRef('acme/app@sha256:abc')).toEqual({ host: 'docker.io', path: 'acme/app' })
    expect(splitImageRef('registry.example.com:5000/acme/shop:1')).toEqual({
      host: 'registry.example.com:5000',
      path: 'acme/shop',
    })
  })

  it('refuses refs without a valid repository path', () => {
    for (const ref of [
      '',
      '/x',
      'ghcr.io/',
      'ghcr.io/acme//app',
      'ghcr.io/acme/app?x=1',
      'ghcr.io/a#b',
    ]) {
      expect(splitImageRef(ref)).toBeNull()
    }
  })
})

describe('coveringScope', () => {
  it('lets the longest path prefix win, whole segments only', () => {
    const wide = { ...SCOPE, id: 2, pathPrefix: '' }
    const team = { ...SCOPE, id: 3, pathPrefix: 'acme/team' }
    const scopes = [wide, SCOPE, team]

    expect(registryScopeFor(scopes, 'ghcr.io/acme/team/app')?.id).toBe(3)
    expect(registryScopeFor(scopes, 'ghcr.io/acme/app')?.id).toBe(1)
    expect(registryScopeFor(scopes, 'ghcr.io/acme-other/app')?.id).toBe(2)
    expect(registryScopeFor([SCOPE], 'ghcr.io/acme-other/app')).toBeNull()
    expect(registryScopeFor([SCOPE], 'quay.io/acme/app')).toBeNull()
    expect(coveringScope(scopes, 'git', 'github.com', 'acme/team/app')?.id).toBe(3)
  })

  it('covers a host only for the uses the credential has', () => {
    expect(registryScopeFor([{ ...SCOPE, uses: ['git'] }], 'ghcr.io/acme/app')).toBeNull()
  })

  it('folds Docker Hub aliases', () => {
    const hub = { ...SCOPE, uses: ['registry' as const], registryHost: 'docker.io', gitHost: null }

    expect(registryScopeFor([hub], 'index.docker.io/acme/app')?.id).toBe(1)
    expect(registryScopeFor([hub], 'acme/app')?.id).toBe(1)
  })

  it('detects two scopes that claim the same host and prefix for a shared use', () => {
    expect(scopesCollide(SCOPE, { ...SCOPE, id: 2 })).toBe(true)
    expect(scopesCollide(SCOPE, { ...SCOPE, id: 2, pathPrefix: 'acme/team' })).toBe(false)
    expect(scopesCollide(SCOPE, { ...SCOPE, id: 2, uses: ['git'], gitHost: 'github.com' })).toBe(
      true,
    )
    expect(
      scopesCollide({ ...SCOPE, uses: ['registry'] }, { ...SCOPE, id: 2, uses: ['git'] }),
    ).toBe(false)
  })
})
