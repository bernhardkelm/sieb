const REPO_URL_MAX_LENGTH = 2048
const COMMIT_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/
const PRINTABLE_PATTERN = /^[\x21-\x7e]+$/

/**
 * Normalises an https repository URL without credentials, query or fragment, safe to hand to
 * git as an argument.
 * @param {unknown} value - Raw value
 * @returns {string | null} - Normalised URL, null when git must not clone it
 */
export const repoUrlOf = (value: unknown): string | null => {
  if (
    typeof value !== 'string' ||
    value.length > REPO_URL_MAX_LENGTH ||
    !PRINTABLE_PATTERN.test(value)
  ) {
    return null
  }

  let url: URL

  try {
    url = new URL(value)
  } catch {
    return null
  }

  const clean =
    url.protocol === 'https:' &&
    url.hostname !== '' &&
    url.username === '' &&
    url.password === '' &&
    url.search === '' &&
    url.hash === '' &&
    url.pathname.length > 1

  return clean ? url.href : null
}

/**
 * Returns the full commit id a revision names, the only form git can fetch shallowly by id.
 * @param {string | null} revision - Revision from sieb
 * @returns {string | null} - Lower-case commit id, null for the default branch
 */
export const fullCommit = (revision: string | null): string | null => {
  const lower = revision?.trim().toLowerCase() ?? ''

  return COMMIT_PATTERN.test(lower) ? lower : null
}

/**
 * Returns whether a value is a commit id as the fetcher reports it.
 * @param {unknown} value - Raw value
 * @returns {boolean} - Whether it is a full lower-case commit id
 */
export const isCommit = (value: unknown): value is string =>
  typeof value === 'string' && COMMIT_PATTERN.test(value)
