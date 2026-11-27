import { coveringScope, type AccessScope } from '#core/accessScope.ts'
import { anonymousHost } from '#core/anonymousCloneHost.ts'
import { defaultCandidates } from '#core/defaultSourceTarget.ts'
import { normalizeHostPrefix } from '#core/credentialHosts.ts'
import { prefixCovers, splitImageRef } from '#core/imageRefParts.ts'
import { normalizeHost, type SourceSkipReason } from '#core/privateAccess.ts'
import { parseRepositoryUrl, repositoryRef, type RepositoryRef } from '#core/repositoryUrl.ts'

/** The repositories sieb would hand out, with the git credential that covers them */
export interface SourceTarget {
  repositories: RepositoryRef[] // 1 to 3, tried in order until one clones
  scope: AccessScope | null // null for an anonymous clone of a public repository
  fromLabel: boolean
}

const COMMIT = /^[0-9a-f]{7,64}$/u

/**
 * Reads the org.opencontainers.image.revision label as a commit.
 * @param {string | null} label - Label value
 * @returns {string | null} - Lower-case commit of 7 to 64 hex digits, null for anything else
 */
export const commitRevision = (label: string | null): string | null => {
  const value = label?.trim().toLowerCase() ?? ''

  return COMMIT.test(value) ? value : null
}

/**
 * Derives the repository of an image from the repository mappings of the credentials, the
 * longest registry prefix winning. A mapping counts only for images its own credential covers
 * as a registry credential.
 * @param {readonly AccessScope[]} scopes - Credentials
 * @param {string} imageRef - Image ref
 * @returns {RepositoryRef | null} - Mapped repository, null when no mapping covers the image
 */
export const mappedRepository = (
  scopes: readonly AccessScope[],
  imageRef: string,
): RepositoryRef | null => {
  const image = splitImageRef(imageRef)
  let best: { length: number; repository: RepositoryRef } | null = null

  if (image === null) {
    return null
  }

  for (const scope of scopes) {
    const { repoMapping } = scope

    if (coveringScope([scope], 'registry', image.host, image.path) === null) {
      continue
    }

    const from = repoMapping === null ? null : normalizeHostPrefix(repoMapping.registryPrefix)
    const to = repoMapping === null ? null : normalizeHostPrefix(repoMapping.repoPrefix)

    if (from === null || to === null) {
      continue
    }

    if (normalizeHost(from.host) !== image.host || !prefixCovers(from.path, image.path)) {
      continue
    }

    const rest = image.path.slice(from.path.length).replace(/^\/+/u, '')
    const repository = repositoryRef(to.host, [to.path, rest].filter(Boolean).join('/'))

    if (repository !== null && (best === null || from.text.length > best.length)) {
      best = { length: from.text.length, repository }
    }
  }

  return best?.repository ?? null
}

/**
 * Returns whether a repository belongs to the owner of an image: the first path segment, the
 * GitHub user or organisation, the GitLab top-level group or the Docker Hub namespace, is the same.
 * @param {RepositoryRef} repository - Repository a source label names
 * @param {string} imageRef - Image ref of the check
 * @returns {boolean} - True for the same owner
 */
const sameOwner = (repository: RepositoryRef, imageRef: string): boolean => {
  const image = splitImageRef(imageRef)

  return image !== null && repository.path.split('/')[0] === image.path.split('/')[0]
}

/**
 * Finds the repositories to clone for an image, in this order: the source label when it names
 * a repository of the image's own owner, with the git credential that covers it or else for an
 * anonymous clone on a known git host (no_credential on any other host); the explicit repoMapping of a registry credential, which needs a git
 * credential; the default mapping of a credential without repoMapping or, for an own image, of
 * the public provider registries (see defaultCandidates). A label inherited from a base image of
 * another owner, or one an image sets to reach a repository of another owner, is ignored; without
 * any other source the skip reason is foreign_repository.
 * @param {readonly AccessScope[]} scopes - Usable credentials
 * @param {string} imageRef - Image ref of the check
 * @param {string | null} sourceLabel - org.opencontainers.image.source of the pulled image
 * @param {boolean} own - Whether the image is an own image (owner self)
 * @returns {SourceTarget | { skip: SourceSkipReason }} - Target with its credential, or why there is none
 */
export const resolveSourceTarget = (
  scopes: readonly AccessScope[],
  imageRef: string,
  sourceLabel: string | null,
  own = false,
): SourceTarget | { skip: SourceSkipReason } => {
  const parsed = sourceLabel === null ? null : parseRepositoryUrl(sourceLabel)
  const label =
    parsed === null || parsed === 'not_https' || sameOwner(parsed, imageRef) ? parsed : null

  const labelScope =
    label === null || label === 'not_https'
      ? null
      : coveringScope(scopes, 'git', label.host, label.path)

  if (
    label !== null &&
    label !== 'not_https' &&
    (labelScope !== null || anonymousHost(scopes, label.host))
  ) {
    return { repositories: [label], scope: labelScope, fromLabel: true }
  }

  const mapped = mappedRepository(scopes, imageRef)

  if (mapped !== null) {
    const scope = coveringScope(scopes, 'git', mapped.host, mapped.path)

    return scope === null
      ? { skip: 'no_credential' }
      : { repositories: [mapped], scope, fromLabel: false }
  }

  const defaults = defaultCandidates(scopes, imageRef, own)

  if (defaults !== null) {
    return { ...defaults, fromLabel: false }
  }

  if (label === 'not_https') {
    return { skip: 'not_https' }
  }

  if (label !== null) {
    return { skip: 'no_credential' }
  }

  return { skip: parsed !== null && label === null ? 'foreign_repository' : 'no_repository' }
}
