import { describe, expect, it } from 'vitest'

import { validateCredentialInput } from '#core/credentialInputValidation.ts'

const GITHUB = {
  provider: 'github',
  label: 'GitHub acme',
  uses: ['registry', 'git'],
  pathPrefix: 'acme',
  secret: 'ghp_token',
}
const GITLAB = { ...GITHUB, provider: 'gitlab', label: 'GitLab', username: 'deploy-bot' }
const DOCKERHUB = {
  ...GITHUB,
  provider: 'dockerhub',
  label: 'Hub',
  uses: ['registry'],
  username: 'acme',
}

/**
 * Returns the error codes of an input by field, or the value when it is valid.
 * @param {Record<string, unknown>} raw - Input
 * @param {boolean} requireSecret - Whether the secret is required
 * @returns {unknown} - Value or codes
 */
const outcome = (raw: Record<string, unknown>, requireSecret = true): unknown => {
  const result = validateCredentialInput(raw, requireSecret)

  return result.ok
    ? result.value
    : Object.fromEntries(result.errors.map((error) => [error.field, error.code]))
}

describe('validateCredentialInput', () => {
  it('fills the default hosts of GitHub and leaves the username optional', () => {
    expect(outcome(GITHUB)).toEqual({
      fields: {
        provider: 'github',
        label: 'GitHub acme',
        uses: ['registry', 'git'],
        registryHost: 'ghcr.io',
        gitHost: 'github.com',
        pathPrefix: 'acme',
        repoMapping: null,
        username: null,
      },
      secret: 'ghp_token',
    })
  })

  it('refuses custom hosts on GitHub and Docker Hub and folds the Docker Hub aliases', () => {
    expect(outcome({ ...GITHUB, registryHost: 'ghcr.example.com' })).toEqual({
      registryHost: 'not_allowed',
    })
    expect(outcome({ ...GITHUB, gitHost: 'github.example.com' })).toEqual({
      gitHost: 'not_allowed',
    })
    expect(outcome({ ...DOCKERHUB, registryHost: 'quay.io' })).toEqual({
      registryHost: 'not_allowed',
    })
    expect(outcome({ ...DOCKERHUB, registryHost: 'index.docker.io' })).toMatchObject({
      fields: { registryHost: 'docker.io', gitHost: null },
    })
  })

  it('takes custom hosts for a self-hosted GitLab and validates them', () => {
    expect(
      outcome({
        ...GITLAB,
        registryHost: 'Registry.Example.com:5050',
        gitHost: 'gitlab.example.com',
      }),
    ).toMatchObject({
      fields: { registryHost: 'registry.example.com:5050', gitHost: 'gitlab.example.com' },
    })
    expect(outcome(GITLAB)).toMatchObject({
      fields: { registryHost: 'registry.gitlab.com', gitHost: 'gitlab.com' },
    })

    for (const host of [
      'https://gitlab.example.com',
      'gitlab',
      '10.0.0.1',
      'gitlab.example.com/path',
      'a..b',
    ]) {
      expect(outcome({ ...GITLAB, gitHost: host })).toEqual({ gitHost: 'invalid' })
    }
  })

  it('allows only the uses the provider supports and stores hosts only for those', () => {
    expect(outcome({ ...DOCKERHUB, uses: ['registry', 'git'] })).toEqual({ uses: 'not_allowed' })
    expect(outcome({ ...GITHUB, uses: [] })).toEqual({ uses: 'required' })
    expect(outcome({ ...GITHUB, uses: ['ssh'] })).toEqual({ uses: 'invalid' })
    expect(outcome({ ...GITHUB, uses: 'git' })).toEqual({ uses: 'invalid' })
    expect(
      outcome({ ...GITHUB, uses: ['git', 'git'], registryHost: 'ignored.example.com' }),
    ).toMatchObject({
      fields: { uses: ['git'], registryHost: null, gitHost: 'github.com' },
    })
  })

  it('requires a username where the provider needs one, without whitespace or colon', () => {
    expect(outcome({ ...GITLAB, username: undefined })).toEqual({ username: 'required' })
    expect(outcome({ ...DOCKERHUB, username: ' ' })).toEqual({ username: 'required' })
    expect(outcome({ ...DOCKERHUB, username: 'a:b' })).toEqual({ username: 'invalid' })
    expect(outcome({ ...DOCKERHUB, username: 'a b' })).toEqual({ username: 'invalid' })
    expect(outcome({ ...GITHUB, username: 'octo' })).toMatchObject({ fields: { username: 'octo' } })
  })

  it('requires the secret on create only and keeps it to one line of printable characters', () => {
    expect(outcome({ ...GITHUB, secret: undefined })).toEqual({ secret: 'required' })
    expect(outcome({ ...GITHUB, secret: undefined }, false)).toMatchObject({ secret: null })
    expect(outcome({ ...GITHUB, secret: 'a\nb' })).toEqual({ secret: 'invalid' })
    expect(outcome({ ...GITHUB, secret: 'x'.repeat(4097) })).toEqual({ secret: 'too_long' })
    expect(outcome({ ...GITHUB, secret: 42 })).toEqual({ secret: 'invalid' })
  })

  it('normalises the path prefix and refuses traversal and odd characters', () => {
    expect(outcome({ ...GITHUB, pathPrefix: '/Acme/Team/' })).toMatchObject({
      fields: { pathPrefix: 'acme/team' },
    })
    expect(outcome({ ...GITHUB, pathPrefix: '' })).toMatchObject({ fields: { pathPrefix: '' } })
    expect(outcome({ ...GITHUB, pathPrefix: undefined })).toEqual({ pathPrefix: 'required' })

    for (const prefix of ['acme/../x', 'acme//x', 'ac me', 'acme?x', 'a'.repeat(201)]) {
      expect(outcome({ ...GITHUB, pathPrefix: prefix })).toEqual({ pathPrefix: 'invalid' })
    }
  })

  it('normalises the repository mapping and refuses a mapping without repository path', () => {
    expect(
      outcome({
        ...GITLAB,
        repoMapping: {
          registryPrefix: 'Registry.GitLab.com/acme/',
          repoPrefix: 'gitlab.com/acme/',
        },
      }),
    ).toMatchObject({
      fields: {
        repoMapping: { registryPrefix: 'registry.gitlab.com/acme', repoPrefix: 'gitlab.com/acme' },
      },
    })
    expect(
      outcome({
        ...GITLAB,
        repoMapping: { registryPrefix: 'registry.gitlab.com', repoPrefix: 'gitlab.com' },
      }),
    ).toEqual({
      'repoMapping.repoPrefix': 'invalid',
    })
    expect(
      outcome({
        ...GITLAB,
        repoMapping: { registryPrefix: 'https://x', repoPrefix: 'gitlab.com/a' },
      }),
    ).toEqual({
      'repoMapping.registryPrefix': 'invalid',
    })
  })

  it('keeps a repository mapping within the hosts and path prefix of its own credential', () => {
    const mapping = (registryPrefix: string, repoPrefix: string) => ({
      repoMapping: { registryPrefix, repoPrefix },
    })

    expect(outcome({ ...GITHUB, ...mapping('ghcr.io/acme/web', 'github.com/acme') })).toMatchObject(
      { fields: { repoMapping: { registryPrefix: 'ghcr.io/acme/web' } } },
    )
    expect(outcome({ ...GITHUB, ...mapping('ghcr.io/other', 'github.com/acme') })).toEqual({
      'repoMapping.registryPrefix': 'outside_scope',
    })
    expect(outcome({ ...GITHUB, ...mapping('docker.io/acme', 'github.com/acme') })).toEqual({
      'repoMapping.registryPrefix': 'outside_scope',
    })
    expect(outcome({ ...GITHUB, ...mapping('ghcr.io/acme', 'github.com/other') })).toEqual({
      'repoMapping.repoPrefix': 'outside_scope',
    })
    expect(outcome({ ...GITHUB, ...mapping('ghcr.io/acme', 'gitlab.com/acme') })).toEqual({
      'repoMapping.repoPrefix': 'outside_scope',
    })
    expect(
      outcome({ ...GITHUB, uses: ['git'], ...mapping('ghcr.io/acme', 'github.com/acme') }),
    ).toEqual({ 'repoMapping.registryPrefix': 'outside_scope' })
    expect(
      outcome({ ...GITHUB, uses: ['registry'], ...mapping('ghcr.io/acme', 'github.com/acme') }),
    ).toMatchObject({ fields: { uses: ['registry'] } })
    expect(outcome({ ...DOCKERHUB, ...mapping('docker.io/acme', 'github.com/acme') })).toEqual({
      'repoMapping.repoPrefix': 'outside_scope',
    })
    expect(
      outcome({
        ...GITLAB,
        uses: ['registry'],
        registryHost: 'registry.example.com',
        ...mapping('registry.example.com/acme', 'gitlab.example.com/acme'),
      }),
    ).toMatchObject({ fields: { registryHost: 'registry.example.com' } })
    expect(
      outcome({
        ...GITLAB,
        uses: ['registry'],
        ...mapping('registry.gitlab.com/acme', 'gitlab.example.com/acme'),
      }),
    ).toEqual({ 'repoMapping.repoPrefix': 'outside_scope' })
  })

  it('checks provider and label', () => {
    expect(outcome({ ...GITHUB, provider: 'bitbucket' })).toEqual({ provider: 'invalid' })
    expect(outcome({ ...GITHUB, provider: undefined })).toEqual({ provider: 'required' })
    expect(outcome({ ...GITHUB, label: ' ' })).toEqual({ label: 'required' })
    expect(outcome({ ...GITHUB, label: 'x'.repeat(65) })).toEqual({ label: 'too_long' })
    expect(outcome({ ...GITHUB, label: 'a\u0007b' })).toEqual({ label: 'invalid' })
  })
})
