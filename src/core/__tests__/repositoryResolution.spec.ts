import { describe, expect, it } from 'vitest'

import type { AccessScope } from '#core/accessScope.ts'
import { readCheckedSource } from '#core/checkedSourceValidation.ts'
import {
  commitRevision,
  mappedRepository,
  resolveSourceTarget,
} from '#core/repositoryResolution.ts'
import { parseRepositoryUrl } from '#core/repositoryUrl.ts'
import { validateSourceRequest } from '#core/sourceRequestValidation.ts'

const GITLAB: AccessScope = {
  id: 1,
  label: 'GitLab',
  uses: ['registry', 'git'],
  registryHost: 'registry.example.com',
  gitHost: 'gitlab.example.com',
  pathPrefix: 'acme',
  repoMapping: {
    registryPrefix: 'registry.example.com/acme',
    repoPrefix: 'gitlab.example.com/acme',
  },
}
const GITHUB: AccessScope = {
  id: 2,
  label: 'GitHub',
  uses: ['git'],
  registryHost: null,
  gitHost: 'github.com',
  pathPrefix: 'acme',
  repoMapping: null,
}

describe('parseRepositoryUrl', () => {
  it('reads https repositories and cuts web paths down to the repository', () => {
    expect(parseRepositoryUrl('https://github.com/Acme/App')).toEqual({
      host: 'github.com',
      path: 'acme/app',
      repoUrl: 'https://github.com/acme/app.git',
    })
    expect(parseRepositoryUrl('git+https://github.com/acme/app.git')?.valueOf()).toMatchObject({
      path: 'acme/app',
    })
    expect(parseRepositoryUrl('https://github.com/acme/app/tree/main/sub')).toMatchObject({
      path: 'acme/app',
    })
    expect(
      parseRepositoryUrl('https://gitlab.example.com/acme/team/app/-/tree/main'),
    ).toMatchObject({
      path: 'acme/team/app',
    })
  })

  it('names other schemes and scp-like addresses not_https and refuses the rest', () => {
    expect(parseRepositoryUrl('http://github.com/acme/app')).toBe('not_https')
    expect(parseRepositoryUrl('ssh://git@github.com/acme/app.git')).toBe('not_https')
    expect(parseRepositoryUrl('git@github.com:acme/app.git')).toBe('not_https')

    for (const label of [
      'https://user:pw@github.com/acme/app',
      'https://github.com:8443/acme/app',
      'https://github.com/app',
      'https://github.com/acme/%2e%2e',
      'https://10.0.0.1/acme/app',
      'github.com/acme/app',
      '',
    ]) {
      expect(parseRepositoryUrl(label)).toBeNull()
    }
  })
})

describe('commitRevision', () => {
  it('accepts 7 to 64 hex digits only', () => {
    expect(commitRevision('ABCDEF0')).toBe('abcdef0')
    expect(commitRevision('a'.repeat(64))).toBe('a'.repeat(64))

    for (const value of ['abc', 'a'.repeat(65), 'main', 'v1.2.3', null, '-x 1234567']) {
      expect(commitRevision(value)).toBeNull()
    }
  })
})

describe('resolveSourceTarget', () => {
  it('takes the source label when a git credential covers it', () => {
    expect(
      resolveSourceTarget(
        [GITLAB, GITHUB],
        'registry.example.com/acme/shop',
        'https://github.com/acme/shop',
      ),
    ).toMatchObject({
      repository: { repoUrl: 'https://github.com/acme/shop.git' },
      scope: { id: 2 },
      fromLabel: true,
    })
  })

  it('falls back to the mapping for a label no credential covers, as inherited from a base image', () => {
    expect(
      resolveSourceTarget(
        [GITLAB],
        'registry.example.com/acme/team/shop',
        'https://github.com/nodejs/docker-node',
      ),
    ).toMatchObject({
      repository: { repoUrl: 'https://gitlab.example.com/acme/team/shop.git' },
      scope: { id: 1 },
      fromLabel: false,
    })
  })

  it('ignores a label of another owner even when a git credential covers it', () => {
    const other = { ...GITHUB, id: 4, pathPrefix: 'other' }

    expect(
      resolveSourceTarget(
        [GITLAB, other],
        'registry.example.com/acme/shop',
        'https://github.com/other/secret',
      ),
    ).toMatchObject({
      repository: { repoUrl: 'https://gitlab.example.com/acme/shop.git' },
      fromLabel: false,
    })
    expect(
      resolveSourceTarget([other], 'registry.example.com/acme/shop', 'https://github.com/other/x'),
    ).toEqual({ skip: 'foreign_repository' })
    expect(
      resolveSourceTarget([other], 'docker.io/other/x', 'https://github.com/other/x'),
    ).toMatchObject({ repository: { repoUrl: 'https://github.com/other/x.git' }, fromLabel: true })
  })

  it('skips with the reason that applies', () => {
    expect(
      resolveSourceTarget(
        [GITHUB],
        'registry.example.com/acme/shop',
        'https://gitlab.other.example/acme/x',
      ),
    ).toEqual({
      skip: 'no_credential',
    })
    expect(
      resolveSourceTarget([GITHUB], 'registry.example.com/acme/shop', 'git@github.com:acme/x.git'),
    ).toEqual({
      skip: 'not_https',
    })
    expect(resolveSourceTarget([GITHUB], 'registry.example.com/acme/shop', null)).toEqual({
      skip: 'no_repository',
    })
  })

  it('maps with the longest registry prefix', () => {
    const team = {
      ...GITLAB,
      id: 3,
      pathPrefix: 'acme/team',
      repoMapping: {
        registryPrefix: 'registry.example.com/acme/team',
        repoPrefix: 'gitlab.example.com/platform',
      },
    }

    expect(mappedRepository([GITLAB, team], 'registry.example.com/acme/team/shop')?.repoUrl).toBe(
      'https://gitlab.example.com/platform/shop.git',
    )
    expect(mappedRepository([GITLAB], 'registry.example.com/other/shop')).toBeNull()
  })

  it('applies a mapping only to images its own credential covers', () => {
    const narrow = { ...GITLAB, pathPrefix: 'acme/team' }
    const gitOnly = { ...GITLAB, uses: ['git' as const] }

    expect(mappedRepository([narrow], 'registry.example.com/acme/shop')).toBeNull()
    expect(mappedRepository([gitOnly], 'registry.example.com/acme/shop')).toBeNull()
    expect(mappedRepository([narrow], 'registry.example.com/acme/team/shop')?.repoUrl).toBe(
      'https://gitlab.example.com/acme/team/shop.git',
    )
  })
})

describe('worker source validation', () => {
  it('reads a checked out source with a normalised URL and a commit', () => {
    const errors: { field: string | null; code: string }[] = []

    expect(
      readCheckedSource(
        { repoUrl: 'https://github.com/acme/app', revision: 'ABCDEF0', fromLabel: true },
        errors,
      ),
    ).toEqual({ repoUrl: 'https://github.com/acme/app.git', revision: 'abcdef0', fromLabel: true })
    expect(readCheckedSource(null, errors)).toBeNull()
    expect(readCheckedSource(undefined, errors)).toBeUndefined()
    expect(errors).toEqual([])
  })

  it('refuses http, credentials in the URL, a branch name and a missing flag', () => {
    const errors: { field: string | null; code: string }[] = []

    readCheckedSource(
      { repoUrl: 'http://github.com/acme/app', revision: null, fromLabel: true },
      errors,
    )
    readCheckedSource(
      { repoUrl: 'https://t:x@github.com/acme/app', revision: null, fromLabel: true },
      errors,
    )
    readCheckedSource(
      { repoUrl: 'https://github.com/acme/app', revision: 'main', fromLabel: false },
      errors,
    )
    readCheckedSource({ repoUrl: 'https://github.com/acme/app', revision: null }, errors)
    readCheckedSource(
      { repoUrl: `https://github.com/acme/${'a'.repeat(500)}`, revision: null, fromLabel: true },
      errors,
    )

    expect(errors).toEqual([
      { field: 'source.repoUrl', code: 'invalid' },
      { field: 'source.repoUrl', code: 'invalid' },
      { field: 'source.revision', code: 'invalid' },
      { field: 'source.fromLabel', code: 'required' },
      { field: 'source.repoUrl', code: 'invalid' },
    ])
  })

  it('validates a source request of the fetcher', () => {
    expect(
      validateSourceRequest({
        imageRef: ' ghcr.io/acme/app ',
        sourceLabel: ' ',
        revisionLabel: 'abc1234',
      }),
    ).toEqual({
      ok: true,
      value: { imageRef: 'ghcr.io/acme/app', sourceLabel: null, revisionLabel: 'abc1234' },
    })
    expect(validateSourceRequest({ sourceLabel: 1, revisionLabel: 'x'.repeat(501) })).toEqual({
      ok: false,
      errors: [
        { field: 'sourceLabel', code: 'invalid' },
        { field: 'revisionLabel', code: 'too_long' },
        { field: 'imageRef', code: 'required' },
      ],
    })
  })
})
