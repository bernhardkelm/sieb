import { normalizeHost } from '#core/privateAccess.ts'
import { registryOf } from '#core/registryHost.ts'

// OCI distribution repository name: lower-case components separated by slashes
const REPOSITORY_PATH =
  /^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*(?:\/[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*)*$/u

/** Registry host and repository path of an image ref */
export interface ImageRefParts {
  host: string // normalised, Docker Hub aliases folded into docker.io
  path: string // repository path without tag or digest, library/ added for official Docker Hub images
}

/**
 * Splits an image ref the way Docker resolves it into its registry host and repository path.
 * A tag or digest is dropped; a single segment on Docker Hub becomes library/<name>.
 * @param {string} imageRef - Image ref, with or without registry host, tag or digest
 * @returns {ImageRefParts | null} - Host and path, null for a ref without a valid repository path
 */
export const splitImageRef = (imageRef: string): ImageRefParts | null => {
  const ref = imageRef.trim().toLowerCase()
  const registry = registryOf(ref)

  if (registry === null) {
    return null
  }

  const named = ref.startsWith(`${registry}/`) ? ref.slice(registry.length + 1) : ref
  const path = named.replace(/@.*$/u, '').replace(/:[^/]*$/u, '')
  const host = normalizeHost(registry)

  if (!REPOSITORY_PATH.test(path)) {
    return null
  }

  return { host, path: host === 'docker.io' && !path.includes('/') ? `library/${path}` : path }
}

/**
 * Returns whether a path prefix covers a path, whole segments only, '' covering every path.
 * @param {string} prefix - Normalised prefix without leading or trailing slash
 * @param {string} path - Path without leading slash
 * @returns {boolean} - True when covered
 */
export const prefixCovers = (prefix: string, path: string): boolean =>
  prefix === '' || path === prefix || path.startsWith(`${prefix}/`)
