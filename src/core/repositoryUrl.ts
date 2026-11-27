import { isCredentialHost } from '#core/credentialHosts.ts'

/** A repository on a git host, addressed over https */
export interface RepositoryRef {
  host: string // lower case, without port
  path: string // lower case, without leading slash and without .git
  repoUrl: string // https://<host>/<path>.git, never with credentials
}

const SEGMENT = /^[a-z0-9_][a-z0-9._-]*$/u
const SCP_LIKE = /^[^@/\s]+@[^:/\s]+:/u
const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//iu

/**
 * Builds a repository ref from a host and a path, refusing hosts and paths git or a URL could
 * read differently.
 * @param {string} host - Git host
 * @param {string} path - Repository path, at least namespace/name
 * @returns {RepositoryRef | null} - Repository, null when host or path is not acceptable
 */
export const repositoryRef = (host: string, path: string): RepositoryRef | null => {
  const cleanHost = host.trim().toLowerCase()
  const cleanPath = path
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/gu, '')
    .replace(/\.git$/u, '')
  const segments = cleanPath.split('/')

  if (!isCredentialHost(cleanHost) || cleanHost.includes(':') || segments.length < 2) {
    return null
  }

  if (!segments.every((segment) => SEGMENT.test(segment) && !/^\.+$/u.test(segment))) {
    return null
  }

  return { host: cleanHost, path: cleanPath, repoUrl: `https://${cleanHost}/${cleanPath}.git` }
}

/**
 * Cuts a web URL path down to the repository: GitHub keeps owner/name, GitLab stops at /-/.
 * @param {string} host - Git host
 * @param {string} pathname - URL path
 * @returns {string} - Repository path
 */
const repositoryPathOf = (host: string, pathname: string): string => {
  const path = pathname.split('/-/')[0] ?? ''

  return host === 'github.com' ? path.split('/').filter(Boolean).slice(0, 2).join('/') : path
}

/**
 * Reads the org.opencontainers.image.source label of an image as an https repository.
 * @param {string} label - Label value
 * @returns {RepositoryRef | 'not_https' | null} - Repository, not_https for another scheme or an scp-like address, null for anything else
 */
export const parseRepositoryUrl = (label: string): RepositoryRef | 'not_https' | null => {
  const text = label.trim().replace(/^git\+/iu, '')

  if (!SCHEME.test(text)) {
    return SCP_LIKE.test(text) ? 'not_https' : null
  }

  let url: URL

  try {
    url = new URL(text)
  } catch {
    return null
  }

  if (url.protocol !== 'https:') {
    return 'not_https'
  }

  if (url.username !== '' || url.password !== '' || url.port !== '') {
    return null
  }

  return repositoryRef(url.hostname, repositoryPathOf(url.hostname, url.pathname))
}
