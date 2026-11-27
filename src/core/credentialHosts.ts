export const MAX_PATH_PREFIX_LENGTH = 200

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u
const PORT = /^[1-9]\d{0,4}$/u
const PATH_SEGMENT = /^[a-z0-9_][a-z0-9._-]*$/u

/**
 * Returns whether a value is a lower-case DNS name with at least one dot and an optional port,
 * as a registry or git host of a credential; IP addresses and single labels are refused.
 * @param {string} value - Host, without scheme or path
 * @returns {boolean} - True for a host such as gitlab.example.com or registry.example.com:5000
 */
export const isCredentialHost = (value: string): boolean => {
  const [name = '', port, ...rest] = value.split(':')
  const labels = name.split('.')

  if (rest.length > 0 || name.length > 253 || labels.length < 2) {
    return false
  }

  if (port !== undefined && (!PORT.test(port) || Number(port) > 65535)) {
    return false
  }

  return labels.every((label) => LABEL.test(label)) && !/^\d+$/u.test(labels.at(-1) ?? '')
}

/**
 * Normalises a path prefix: trimmed, lower case, without leading and trailing slashes, made of
 * segments a registry or git path may hold.
 * @param {string} value - Prefix as entered, '' for the whole host
 * @returns {string | null} - Normalised prefix, null when invalid
 */
export const normalizePathPrefix = (value: string): string | null => {
  const prefix = value
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/gu, '')

  if (prefix === '') {
    return ''
  }

  if (prefix.length > MAX_PATH_PREFIX_LENGTH) {
    return null
  }

  const segments = prefix.split('/')

  return segments.every((segment) => PATH_SEGMENT.test(segment) && !/^\.+$/u.test(segment))
    ? prefix
    : null
}

/**
 * Normalises a host/path prefix of a repository mapping such as registry.gitlab.com/group/.
 * @param {string} value - Prefix as entered, without scheme
 * @returns {{ host: string; path: string; text: string } | null} - Host, path and normalised text without trailing slash, null when invalid
 */
export const normalizeHostPrefix = (
  value: string,
): { host: string; path: string; text: string } | null => {
  const text = value.trim().toLowerCase().replace(/\/+$/u, '')
  const slash = text.indexOf('/')
  const host = slash === -1 ? text : text.slice(0, slash)
  const path = normalizePathPrefix(slash === -1 ? '' : text.slice(slash + 1))

  if (!isCredentialHost(host) || path === null) {
    return null
  }

  return { host, path, text: path === '' ? host : `${host}/${path}` }
}
