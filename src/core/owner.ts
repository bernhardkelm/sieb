/** Owner label of your own images, ranked before every other owner */
export const SELF_OWNER = 'self'

export const OWNER_MAX_LENGTH = 64

// commas would split the owner query list, control characters have no place in a label
const INVALID_OWNER_CHARACTERS = /[,\p{Cc}]/u

/**
 * Parses a free-form owner label: trimmed, at most OWNER_MAX_LENGTH characters, without commas
 * or control characters.
 * @param {unknown} value - Raw label
 * @returns {string | null} - Owner, null for a missing, empty or invalid label
 */
export const parseOwner = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }

  const owner = value.trim()

  if (owner === '' || owner.length > OWNER_MAX_LENGTH || INVALID_OWNER_CHARACTERS.test(owner)) {
    return null
  }

  return owner
}

/**
 * Returns whether a value is a valid owner label as parseOwner keeps it.
 * @param {unknown} value - Value to test
 * @returns {boolean} - True for a trimmed, valid owner
 */
export const isOwner = (value: unknown): value is string =>
  typeof value === 'string' && parseOwner(value) === value

/**
 * Compares two owners for a sort with own images first, then the other owners alphabetically,
 * then findings without an owner.
 * @param {string | null} a - First owner
 * @param {string | null} b - Second owner
 * @returns {number} - Negative when a sorts before b
 */
export const compareOwner = (a: string | null, b: string | null): number => {
  if (a === b) {
    return 0
  }

  if (a === null || b === SELF_OWNER) {
    return 1
  }

  if (b === null || a === SELF_OWNER) {
    return -1
  }

  return a < b ? -1 : 1
}

/**
 * Returns a text sort key of an owner that places self before every other owner.
 * @param {string | null} owner - Owner, null for none
 * @returns {string | null} - Empty text for self, the owner otherwise, null for none
 */
export const ownerSortKey = (owner: string | null): string | null =>
  owner === SELF_OWNER ? '' : owner

/**
 * Returns the owner ranked first among several, see compareOwner.
 * @param {readonly (string | null)[]} owners - Owners, null for none
 * @returns {string | null} - First owner, null when none is set
 */
export const firstOwner = (owners: readonly (string | null)[]): string | null =>
  [...owners].sort(compareOwner)[0] ?? null

/**
 * Returns the distinct owners of several, in compareOwner order.
 * @param {readonly (string | null)[]} owners - Owners, null for none
 * @returns {string[]} - Distinct owners, missing ones left out
 */
export const distinctOwners = (owners: readonly (string | null)[]): string[] =>
  [...new Set(owners.filter((owner) => owner !== null))].sort(compareOwner)
