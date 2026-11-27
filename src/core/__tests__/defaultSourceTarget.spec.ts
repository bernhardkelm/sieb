import { describe, expect, it } from 'vitest'

import type { AccessScope } from '#core/accessScope.ts'
import { defaultRepoMapping, defaultRepositories } from '#core/defaultRepoMapping.ts'
import { defaultCandidates } from '#core/defaultSourceTarget.ts'
import { resolveSourceTarget } from '#core/repositoryResolution.ts'

const SELF_HOSTED: AccessScope = {
  id: 1,
  label: 'GitLab',
  uses: ['registry', 'git'],
  registryHost: 'registry.example.com',
  gitHost: 'gitlab.example.com',
  pathPrefix: 'acme',
  repoMapping: null,
}
const GITHUB: AccessScope = {
  id: 2,
  label: 'GitHub',
  uses: ['registry', 'git'],
  registryHost: 'ghcr.io',
  gitHost: 'github.com',
  pathPrefix: 'acme',
  repoMapping: null,
}

/**
 * Lists the repository URLs of candidates.
 * @param {{ repositories: { repoUrl: string }[] } | null} candidates - Candidates
 * @returns {string[] | null} - URLs, null without candidates
 */
const urls = (candidates: { repositories: { repoUrl: string }[] } | null): string[] | null =>
  candidates?.repositories.map((repository) => repository.repoUrl) ?? null

describe('defaultRepoMapping', () => {
  it('maps GitHub by owner and name, GitLab by project path, Docker Hub not at all', () => {
    expect(defaultRepoMapping('github', 'ghcr.io', 'github.com')).toEqual({
      registryHost: 'ghcr.io',
      gitHost: 'github.com',
      segments: 2,
    })
    expect(defaultRepoMapping('gitlab', 'registry.example.com', 'gitlab.example.com')).toEqual({
      registryHost: 'registry.example.com',
      gitHost: 'gitlab.example.com',
      segments: null,
    })
    expect(defaultRepoMapping('dockerhub', 'docker.io', null)).toBeNull()
    expect(defaultRepoMapping('gitlab', 'registry.example.com', null)).toBeNull()
  })

  it('derives up to three GitLab candidates longest first and one GitHub repository', () => {
    const gitlab = defaultRepoMapping('gitlab', 'registry.gitlab.com', 'gitlab.com')!
    const github = defaultRepoMapping('github', 'ghcr.io', 'github.com')!

    expect(defaultRepositories(gitlab, 'group/sub/project/image').map((r) => r.path)).toEqual([
      'group/sub/project/image',
      'group/sub/project',
      'group/sub',
    ])
    expect(defaultRepositories(gitlab, 'group/project').map((r) => r.path)).toEqual([
      'group/project',
    ])
    expect(defaultRepositories(github, 'acme/app/worker').map((r) => r.path)).toEqual(['acme/app'])
    expect(defaultRepositories(github, 'acme')).toEqual([])
  })
})

describe('defaultCandidates', () => {
  it('uses the default mapping of a covering credential without repoMapping', () => {
    const found = defaultCandidates([SELF_HOSTED], 'registry.example.com/acme/team/app', false)

    expect(urls(found)).toEqual([
      'https://gitlab.example.com/acme/team/app.git',
      'https://gitlab.example.com/acme/team.git',
    ])
    expect(found?.scope?.id).toBe(1)
    expect(urls(defaultCandidates([GITHUB], 'ghcr.io/acme/app', false))).toEqual([
      'https://github.com/acme/app.git',
    ])
  })

  it('leaves an explicit repoMapping in charge', () => {
    const mapped = {
      ...SELF_HOSTED,
      repoMapping: {
        registryPrefix: 'registry.example.com/acme',
        repoPrefix: 'gitlab.example.com/acme/src',
      },
    }

    expect(defaultCandidates([mapped], 'registry.example.com/acme/app', false)).toBeNull()
    expect(
      resolveSourceTarget([mapped], 'registry.example.com/acme/app', null, true),
    ).toMatchObject({ repositories: [{ repoUrl: 'https://gitlab.example.com/acme/src/app.git' }] })
  })

  it('offers own images of the public provider registries an anonymous clone', () => {
    expect(defaultCandidates([], 'ghcr.io/example-user/app', true)).toEqual({
      repositories: [
        {
          host: 'github.com',
          path: 'example-user/app',
          repoUrl: 'https://github.com/example-user/app.git',
        },
      ],
      scope: null,
    })
    expect(urls(defaultCandidates([], 'registry.gitlab.com/group/project/image', true))).toEqual([
      'https://gitlab.com/group/project/image.git',
      'https://gitlab.com/group/project.git',
    ])
    expect(defaultCandidates([], 'ghcr.io/example-user/app', false)).toBeNull()
    expect(defaultCandidates([], 'registry.example.com/acme/app', true)).toBeNull()
  })

  it('lets an own-owner source label win over the default mapping', () => {
    expect(
      resolveSourceTarget([GITHUB], 'ghcr.io/acme/app', 'https://github.com/acme/monorepo', true),
    ).toMatchObject({
      repositories: [{ repoUrl: 'https://github.com/acme/monorepo.git' }],
      scope: { id: 2 },
      fromLabel: true,
    })
  })
})
