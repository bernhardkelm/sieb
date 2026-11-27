/** Registries whose third-party images count as public until the pull probe answers, SIEB_PUBLIC_REGISTRIES */
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
