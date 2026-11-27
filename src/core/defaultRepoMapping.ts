import { PROVIDER_SPECS, type AccessProvider } from '#core/privateAccess.ts'
import { repositoryRef, type RepositoryRef } from '#core/repositoryUrl.ts'

/** How a provider's image paths name repositories when a credential sets no repoMapping */
export interface DefaultRepoMapping {
  registryHost: string
  gitHost: string
  segments: number | null // leading image path segments that name the repository, null for the GitLab project path
}

const MAX_CANDIDATES = 3

/**
 * Returns the repository mapping a credential gets by default: GitHub ghcr.io/<owner>/<name> to
 * github.com/<owner>/<name>, GitLab <registryHost>/<path> to <gitHost>/<path>, where a nested
 * image name such as group/project/image tries the longest path first. Docker Hub has none.
 * @param {AccessProvider} provider - Provider of the credential
 * @param {string | null} registryHost - Registry host, null without the registry use
 * @param {string | null} gitHost - Git host, null without the git use
 * @returns {DefaultRepoMapping | null} - Mapping, null when the provider or a host is missing
 */
export const defaultRepoMapping = (
  provider: AccessProvider,
  registryHost: string | null,
  gitHost: string | null,
): DefaultRepoMapping | null => {
  if (registryHost === null || gitHost === null || provider === 'dockerhub') {
    return null
  }

  return { registryHost, gitHost, segments: provider === 'github' ? 2 : null }
}

/** Default mappings of the public provider registries, for own images without a credential */
export const PUBLIC_PROVIDER_MAPPINGS: readonly DefaultRepoMapping[] = (
  ['github', 'gitlab'] as const
)
  .map((provider) =>
    defaultRepoMapping(
      provider,
      PROVIDER_SPECS[provider].registryHost,
      PROVIDER_SPECS[provider].gitHost,
    ),
  )
  .filter((mapping) => mapping !== null)

/**
 * Derives the repositories a default mapping names for an image path, longest first: one for
 * GitHub, up to three for GitLab, each with at least two path segments.
 * @param {DefaultRepoMapping} mapping - Default mapping
 * @param {string} imagePath - Repository path of the image on the mapping's registry
 * @returns {RepositoryRef[]} - Candidate repositories, empty when the path names none
 */
export const defaultRepositories = (
  mapping: DefaultRepoMapping,
  imagePath: string,
): RepositoryRef[] => {
  const parts = imagePath.split('/').filter(Boolean)
  const longest = mapping.segments === null ? parts : parts.slice(0, mapping.segments)
  const lengths =
    mapping.segments === null
      ? Array.from({ length: longest.length - 1 }, (_, index) => longest.length - index)
      : [longest.length]

  return lengths
    .filter((length) => length >= 2 && length <= parts.length)
    .slice(0, MAX_CANDIDATES)
    .map((length) => repositoryRef(mapping.gitHost, longest.slice(0, length).join('/')))
    .filter((repository) => repository !== null)
}
