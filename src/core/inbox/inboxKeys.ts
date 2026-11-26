import { INBOX_KINDS, type InboxKind, type SeeableInboxKind } from '#core/inbox/inboxItem.ts'

/** Longest key accepted by POST /api/inbox/seen */
export const MAX_INBOX_KEY_LENGTH = 120

const ID = '[1-9][0-9]{0,15}'
const EXPIRING_KEY = new RegExp(`^expiring:${ID}:(.+)$`)
const KEV_KEY = new RegExp(`^kev:${ID}$`)

/**
 * Builds the key of a proposal item.
 * @param {number} proposalId - Proposal id
 * @returns {string} - Key
 */
export const proposalKey = (proposalId: number): string => `proposal:${proposalId}`

/**
 * Builds the key of a re-opened decision item, a new re-open brings a new key.
 * @param {number} decisionId - Decision id
 * @param {string | null} reopenedAt - Latched re-open time, null for a re-open no sync latched yet
 * @returns {string} - Key
 */
export const reopenedKey = (decisionId: number, reopenedAt: string | null): string =>
  `reopened:${decisionId}:${reopenedAt ?? 'pending'}`

/**
 * Builds the key of an expiring decision item, an extension brings a new key.
 * @param {number} decisionId - Decision id
 * @param {string} expiresAt - Expiry of the decision
 * @returns {string} - Key
 */
export const expiringKey = (decisionId: number, expiresAt: string): string =>
  `expiring:${decisionId}:${expiresAt}`

/**
 * Builds the key of a new KEV listing item.
 * @param {number} findingId - Finding id
 * @returns {string} - Key
 */
export const kevKey = (findingId: number): string => `kev:${findingId}`

/**
 * Reads the kind prefix of a key.
 * @param {string} key - Item key
 * @returns {InboxKind | null} - Kind, null for an unknown prefix
 */
export const inboxKindOf = (key: string): InboxKind | null => {
  const prefix = key.slice(0, key.indexOf(':'))

  return (INBOX_KINDS as readonly string[]).includes(prefix) ? (prefix as InboxKind) : null
}

/**
 * Returns the kind of a well-formed key a user may mark as seen: kev:<findingId> or
 * expiring:<decisionId>:<expiresAt> with a parseable time.
 * @param {string} key - Item key
 * @returns {SeeableInboxKind | null} - Kind, null for a malformed key or another kind
 */
export const seeableKindOf = (key: string): SeeableInboxKind | null => {
  if (key.length > MAX_INBOX_KEY_LENGTH) {
    return null
  }

  if (KEV_KEY.test(key)) {
    return 'kev'
  }

  const expiresAt = EXPIRING_KEY.exec(key)?.[1]

  return expiresAt !== undefined && !Number.isNaN(Date.parse(expiresAt)) ? 'expiring' : null
}
