const FINDING_PREFIX = 'finding:'
const GROUP_PREFIX = 'group:'

export const ROW_KEY_ATTRIBUTE = 'data-row-key'

/**
 * Returns the cursor key of a finding row.
 * @param {number} id - Finding id
 * @returns {string} - Row key
 */
export const findingRowKey = (id: number): string => `${FINDING_PREFIX}${id}`

/**
 * Returns the cursor key of a group row, such as an image, a CVE or a decision.
 * @param {string | number} value - Group identifier
 * @returns {string} - Row key
 */
export const groupRowKey = (value: string | number): string => `${GROUP_PREFIX}${value}`

/**
 * Reads the finding id of a finding row key.
 * @param {string | null} key - Row key
 * @returns {number | null} - Finding id, null for other keys
 */
export const findingIdOfRowKey = (key: string | null): number | null =>
  key?.startsWith(FINDING_PREFIX) ? Number(key.slice(FINDING_PREFIX.length)) : null

/**
 * Reads the group identifier of a group row key.
 * @param {string | null} key - Row key
 * @returns {string | null} - Group identifier, null for other keys
 */
export const groupOfRowKey = (key: string | null): string | null =>
  key?.startsWith(GROUP_PREFIX) ? key.slice(GROUP_PREFIX.length) : null
