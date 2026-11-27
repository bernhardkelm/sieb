import { registryOf } from '#core/registryHost.ts'

interface CodeHost {
  host: string
  /** Leading path segments that name the repository, null for the whole path */
  segments: number | null
}

/** Registries whose image path mirrors the repository path on their code host */
const CODE_HOSTS: Readonly<Record<string, CodeHost>> = {
  'registry.gitlab.com': { host: 'gitlab.com', segments: null },
  'ghcr.io': { host: 'github.com', segments: 2 },
  'docker.pkg.github.com': { host: 'github.com', segments: 2 },
}

const PATH_SEGMENT = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/

/**
 * Removes a digest and a tag from an image ref, a registry port stays.
 * @param {string} imageRef - Image ref, possibly with :tag or @digest
 * @returns {string} - Registry and repository
 */
export const repositoryOf = (imageRef: string): string => {
  const withoutDigest = imageRef.split('@')[0] ?? ''
  const slash = withoutDigest.lastIndexOf('/')
  const colon = withoutDigest.lastIndexOf(':')

  return colon > slash ? withoutDigest.slice(0, colon) : withoutDigest
}

/**
 * Derives the likely source repository of an image from registries whose image path mirrors
 * the repository path, such as registry.gitlab.com/group/project or ghcr.io/owner/repo. The
 * result is a guess and returns only plain path segments, so it is safe to put into a prompt.
 * @param {string} imageRef - Image ref, registry/repository with or without tag or digest
 * @returns {string | null} - Host and path such as gitlab.com/group/project, null without a guess
 */
export const repositoryHint = (imageRef: string): string | null => {
  const ref = repositoryOf(imageRef.trim().toLowerCase())
  const registry = registryOf(ref)
  const codeHost = registry === null ? undefined : CODE_HOSTS[registry]

  if (codeHost === undefined || !ref.startsWith(`${registry}/`)) {
    return null
  }

  const path = ref.slice(`${registry}/`.length).split('/')
  const segments = codeHost.segments === null ? path : path.slice(0, codeHost.segments)

  if (segments.length < 2 || !segments.every((segment) => PATH_SEGMENT.test(segment))) {
    return null
  }

  return `${codeHost.host}/${segments.join('/')}`
}
