import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const TOKEN_SECRET_PREFIX = 'sieb_'

const SECRET_BYTES = 32
const DISPLAY_PREFIX_LENGTH = TOKEN_SECRET_PREFIX.length + 8
const SECRET_PATTERN = /^sieb_[A-Za-z0-9_-]{43}$/
const HASH_PATTERN = /^[0-9a-f]{64}$/

/**
 * Generates a new personal token secret: the sieb_ prefix and 32 random bytes in base64url.
 * @returns {string} - Secret, shown to its owner once
 */
export const generateTokenSecret = (): string =>
  `${TOKEN_SECRET_PREFIX}${randomBytes(SECRET_BYTES).toString('base64url')}`

/**
 * Returns whether a bearer value has the shape of a personal token secret.
 * @param {string} value - Bearer value
 * @returns {boolean} - True for sieb_ and 43 base64url characters
 */
export const isTokenSecret = (value: string): boolean => SECRET_PATTERN.test(value)

/**
 * Hashes a secret for storage and lookup.
 * @param {string} secret - Token secret
 * @returns {string} - Lower-case hex sha-256
 */
export const hashTokenSecret = (secret: string): string =>
  createHash('sha256').update(secret, 'utf8').digest('hex')

/**
 * Returns the start of a secret the UI shows to recognise a token.
 * @param {string} secret - Token secret
 * @returns {string} - Prefix and the first 8 random characters
 */
export const displayPrefixOf = (secret: string): string => secret.slice(0, DISPLAY_PREFIX_LENGTH)

/**
 * Compares two sha-256 hex hashes in constant time.
 * @param {string} expected - Stored hash
 * @param {string} actual - Hash of the presented secret
 * @returns {boolean} - True when both are valid hashes and equal
 */
export const hashesMatch = (expected: string, actual: string): boolean =>
  HASH_PATTERN.test(expected) &&
  HASH_PATTERN.test(actual) &&
  timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'))
