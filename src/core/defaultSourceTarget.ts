import { coveringScope, type AccessScope } from '#core/accessScope.ts'
import {
  defaultRepoMapping,
  defaultRepositories,
  PUBLIC_PROVIDER_MAPPINGS,
  type DefaultRepoMapping,
} from '#core/defaultRepoMapping.ts'
import { splitImageRef, type ImageRefParts } from '#core/imageRefParts.ts'
import { normalizeHost, type AccessProvider } from '#core/privateAccess.ts'
import type { RepositoryRef } from '#core/repositoryUrl.ts'

/** Repositories a default mapping names for an image, with the git credential that covers them */
export interface DefaultCandidates {
  repositories: RepositoryRef[] // 1 to 3, longest path first
  scope: AccessScope | null // null for an anonymous clone
}

const MAX_CANDIDATES = 3

/**
 * Tells the provider of a scope from its registry host, the only host a provider fixes.
 * @param {AccessScope} scope - Credential scope with a registry host
 * @returns {AccessProvider} - github for ghcr.io, dockerhub for Docker Hub, else gitlab
 */
const providerOf = (scope: AccessScope): AccessProvider => {
  const host = normalizeHost(scope.registryHost ?? '')

  if (host === 'ghcr.io') {
    return 'github'
  }

  return host === 'docker.io' ? 'dockerhub' : 'gitlab'
}

/**
 * Lists the default mappings that apply to an image: those of the registry and git credentials
 * without a repoMapping that cover it, then for an own image those of the public provider registries.
 * @param {readonly AccessScope[]} scopes - Usable credentials
 * @param {ImageRefParts} image - Registry host and repository path
 * @param {boolean} own - Whether the image is an own image
 * @returns {DefaultRepoMapping[]} - Mappings on the image's registry host
 */
const mappingsFor = (
  scopes: readonly AccessScope[],
  image: ImageRefParts,
  own: boolean,
): DefaultRepoMapping[] => [
  ...scopes
    .filter(
      (scope) =>
        scope.repoMapping === null &&
        scope.uses.includes('git') &&
        coveringScope([scope], 'registry', image.host, image.path) !== null,
    )
    .map((scope) => defaultRepoMapping(providerOf(scope), scope.registryHost, scope.gitHost))
    .filter((mapping) => mapping !== null)
    .filter((mapping) => normalizeHost(mapping.registryHost) === image.host),
  ...(own ? PUBLIC_PROVIDER_MAPPINGS : []).filter((mapping) => mapping.registryHost === image.host),
]

/**
 * Derives the repositories of an image from the default mappings: with the git credential that
 * covers the first of them and only the candidates it covers too, else for an own image every
 * candidate for an anonymous clone that decides which one exists and is public.
 * @param {readonly AccessScope[]} scopes - Usable credentials
 * @param {string} imageRef - Image ref of the check
 * @param {boolean} own - Whether the image is an own image
 * @returns {DefaultCandidates | null} - Candidates, null when no default mapping names one
 */
export const defaultCandidates = (
  scopes: readonly AccessScope[],
  imageRef: string,
  own: boolean,
): DefaultCandidates | null => {
  const image = splitImageRef(imageRef)
  const seen = new Set<string>()
  const repositories = (image === null ? [] : mappingsFor(scopes, image, own))
    .flatMap((mapping) => defaultRepositories(mapping, image?.path ?? ''))
    .filter((repository) => !seen.has(repository.repoUrl) && seen.add(repository.repoUrl))
    .slice(0, MAX_CANDIDATES)

  for (const repository of repositories) {
    const scope = coveringScope(scopes, 'git', repository.host, repository.path)

    if (scope !== null) {
      return {
        repositories: repositories.filter(
          (other) => coveringScope(scopes, 'git', other.host, other.path)?.id === scope.id,
        ),
        scope,
      }
    }
  }

  return own && repositories.length > 0 ? { repositories, scope: null } : null
}
