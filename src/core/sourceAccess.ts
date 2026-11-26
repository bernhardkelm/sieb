import { SELF_OWNER } from '#core/owner.ts'

/** Whether Claude can read the source behind an image: public, private or unknown */
export const SOURCE_ACCESS_LEVELS = ['public', 'private', 'unknown'] as const

export type SourceAccess = (typeof SOURCE_ACCESS_LEVELS)[number]

/** Registries whose images count as public unless the owner is self, SIEB_PUBLIC_REGISTRIES */
export const DEFAULT_PUBLIC_REGISTRIES: readonly string[] = [
  'docker.io',
  'index.docker.io',
  'registry-1.docker.io',
  'mirror.gcr.io',
  'ghcr.io',
  'quay.io',
  'registry.k8s.io',
  'gcr.io',
  'public.ecr.aws',
  'mcr.microsoft.com',
  'cgr.dev',
]

const IMPLICIT_REGISTRY = 'docker.io'

/**
 * Returns the registry host of an image ref the way Docker resolves it: the first path segment
 * when it holds a dot or a port or is localhost, else the implicit Docker Hub.
 * @param {string} imageRef - Image ref, registry/repository without tag
 * @returns {string | null} - Lower-case registry host, null for an empty ref
 */
export const registryOf = (imageRef: string): string | null => {
  const ref = imageRef.trim().toLowerCase()

  if (ref === '' || ref.startsWith('/')) {
    return null
  }

  const slash = ref.indexOf('/')
  const first = slash === -1 ? '' : ref.slice(0, slash)

  if (first.includes('.') || first.includes(':') || first === 'localhost') {
    return first
  }

  return IMPLICIT_REGISTRY
}

/**
 * Classifies whether the source of an image is readable from outside: private for own images
 * (owner self), public for images of a public registry with another owner, unknown for every
 * other registry and for a ref that names none, since such an image may or may not be pullable.
 * @param {string} imageRef - Image ref, registry/repository without tag
 * @param {string | null} owner - Owner label, null without one
 * @param {readonly string[]} publicRegistries - Lower-case public registry hosts
 * @returns {SourceAccess} - public, private or unknown
 */
export const sourceAccess = (
  imageRef: string,
  owner: string | null,
  publicRegistries: readonly string[],
): SourceAccess => {
  if (owner === SELF_OWNER) {
    return 'private'
  }

  const registry = registryOf(imageRef)

  if (registry === null) {
    return 'unknown'
  }

  return publicRegistries.includes(registry) ? 'public' : 'unknown'
}
