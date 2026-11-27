import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Hashes a value, so secrets of any length compare in constant time.
 * @param {string} value - Value
 * @returns {Buffer} - SHA-256 digest
 */
const digest = (value: string): Buffer => createHash('sha256').update(value).digest()

/**
 * Creates the check of the local endpoint's bearer token.
 * @param {string} secret - SIEB_FETCHER_LOCAL_SECRET
 * @returns {(header: string | undefined) => boolean} - Whether an authorization header carries the secret
 */
export const localAuth = (secret: string): ((header: string | undefined) => boolean) => {
  const expected = digest(secret)

  return (header) => {
    const token = /^Bearer (\S+)$/.exec(header ?? '')?.[1]

    return token !== undefined && timingSafeEqual(digest(token), expected)
  }
}
