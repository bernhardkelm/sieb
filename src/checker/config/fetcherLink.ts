import { secretValue, type ReadSecretFile } from '#checker/config/secretValue.ts'

/** Where the checker reaches the fetcher of its pod */
export interface FetcherLink {
  url: string // http://127.0.0.1:<port>, loopback only
  secret: string // SIEB_FETCHER_LOCAL_SECRET
}

export const DEFAULT_SHARED_DIR = '/shared'
const LOCAL_SECRET = 'SIEB_FETCHER_LOCAL_SECRET'
const LOCAL_SECRET_MIN_LENGTH = 32
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

/**
 * Reads the local secret the checker and the fetcher share.
 * @param {Record<string, string | undefined>} env - Environment
 * @param {ReadSecretFile} readFile - Reads secret files
 * @returns {string | null} - Secret, null when neither variable is set
 * @throws {Error} - When it is shorter than 32 characters or malformed
 */
export const localSecret = (
  env: Record<string, string | undefined>,
  readFile?: ReadSecretFile,
): string | null => {
  const secret = secretValue(env, LOCAL_SECRET, readFile)

  if (secret !== null && secret.length < LOCAL_SECRET_MIN_LENGTH) {
    throw new Error(`${LOCAL_SECRET} must have at least ${LOCAL_SECRET_MIN_LENGTH} characters`)
  }

  return secret
}

/**
 * Validates SIEB_FETCHER_URL: plain http to a loopback address of the pod, so the local secret
 * never leaves it.
 * @param {string} value - Raw value
 * @returns {string} - Origin of the URL
 * @throws {Error} - For any other URL
 */
const loopbackUrl = (value: string): string => {
  let url: URL | null = null

  try {
    url = new URL(value)
  } catch {
    url = null
  }

  if (
    url === null ||
    url.protocol !== 'http:' ||
    !LOOPBACK_HOSTS.has(url.hostname) ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.username !== ''
  ) {
    throw new Error(`SIEB_FETCHER_URL must be http://127.0.0.1:<port>, got "${value}"`)
  }

  return url.origin
}

/**
 * Reads the fetcher link of two-container mode. The checker refuses the fetcher's sieb secret,
 * which must stay in the fetcher container.
 * @param {Record<string, string | undefined>} env - Environment
 * @param {ReadSecretFile} readFile - Reads secret files
 * @returns {FetcherLink | null} - Link, null in single-container mode
 * @throws {Error} - For a fetcher secret, a URL without local secret or the other way round
 */
export const readFetcherLink = (
  env: Record<string, string | undefined>,
  readFile?: ReadSecretFile,
): FetcherLink | null => {
  const refused = (['SIEB_FETCHER_SECRET', 'SIEB_FETCHER_SECRET_FILE'] as const).find((name) =>
    env[name]?.trim(),
  )

  if (refused !== undefined) {
    throw new Error(`${refused} belongs to the fetcher container, not to the checker`)
  }

  const raw = env.SIEB_FETCHER_URL?.trim()
  const secret = localSecret(env, readFile)

  if (!raw) {
    if (secret !== null) {
      throw new Error(`${LOCAL_SECRET} needs SIEB_FETCHER_URL`)
    }

    return null
  }

  const url = loopbackUrl(raw)

  if (secret === null) {
    throw new Error(`${LOCAL_SECRET} is required with SIEB_FETCHER_URL, directly or as _FILE`)
  }

  return { url, secret }
}
