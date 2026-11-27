// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { isTrustedRealm } from '#server/credentials/probe/tokenRealm.ts'

const GITHUB = { provider: 'github' as const, hosts: ['ghcr.io'] }
const GITLAB_COM = { provider: 'gitlab' as const, hosts: ['registry.gitlab.com'] }
const DOCKER_HUB = { provider: 'dockerhub' as const, hosts: ['docker.io'] }
const SELF_HOSTED = {
  provider: 'gitlab' as const,
  hosts: ['registry.example.co.uk', 'gitlab.example.co.uk'],
}

describe('isTrustedRealm', () => {
  it('trusts the hosts of the credential and the known auth host of its provider', () => {
    expect(isTrustedRealm('https://ghcr.io/token', 'ghcr.io', GITHUB)).toBe(true)
    expect(isTrustedRealm('https://gitlab.com/jwt/auth', 'registry.gitlab.com', GITLAB_COM)).toBe(
      true,
    )
    expect(isTrustedRealm('https://auth.docker.io/token', 'docker.io', DOCKER_HUB)).toBe(true)
    expect(isTrustedRealm('https://registry-1.docker.io/token', 'docker.io', DOCKER_HUB)).toBe(true)
    expect(
      isTrustedRealm(
        'https://gitlab.example.co.uk/jwt/auth',
        'registry.example.co.uk',
        SELF_HOSTED,
      ),
    ).toBe(true)
  })

  it('refuses parent domains, auth hosts of other providers and other hosts', () => {
    expect(isTrustedRealm('https://co.uk/token', 'registry.example.co.uk', SELF_HOSTED)).toBe(false)
    expect(
      isTrustedRealm('https://example.co.uk/token', 'registry.example.co.uk', SELF_HOSTED),
    ).toBe(false)
    expect(
      isTrustedRealm('https://gitlab.com/jwt/auth', 'registry.example.co.uk', SELF_HOSTED),
    ).toBe(false)
    expect(isTrustedRealm('https://auth.docker.io/token', 'ghcr.io', GITHUB)).toBe(false)
    expect(isTrustedRealm('https://github.com/token', 'ghcr.io', GITHUB)).toBe(false)
    expect(isTrustedRealm('https://docker.io/token', 'docker.io', GITHUB)).toBe(false)
    expect(isTrustedRealm('https://evil.example.org/token', 'ghcr.io', GITHUB)).toBe(false)
  })

  it('refuses plain http, userinfo, another port and an invalid URL', () => {
    expect(isTrustedRealm('http://ghcr.io/token', 'ghcr.io', GITHUB)).toBe(false)
    expect(isTrustedRealm('https://user@ghcr.io/token', 'ghcr.io', GITHUB)).toBe(false)
    expect(isTrustedRealm('https://:pw@ghcr.io/token', 'ghcr.io', GITHUB)).toBe(false)
    expect(isTrustedRealm('https://ghcr.io:8443/token', 'ghcr.io', GITHUB)).toBe(false)
    expect(isTrustedRealm('not a url', 'ghcr.io', GITHUB)).toBe(false)
  })
})
