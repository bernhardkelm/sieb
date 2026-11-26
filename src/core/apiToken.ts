import type { ValidationIssue } from '#core/apiTypes.ts'
import { readExpiry } from '#core/decisionFieldReaders.ts'
import type { DecisionInputError } from '#core/decisionInputError.ts'

export const API_TOKEN_SCOPES = ['read', 'propose'] as const

export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number]

/** MCP scope a token grants, `sieb:propose` implies `sieb:read` */
export type ApiTokenGrant = 'sieb:read' | 'sieb:propose'

export const MAX_TOKEN_NAME_LENGTH = 64

/** Live tokens (neither revoked nor expired) one user may hold */
export const MAX_LIVE_TOKENS = 20

/** Longest lifetime of a new token; a date-only expiry ends that day, hence one day of slack */
export const MAX_TOKEN_DAYS = 365

const DAY_MS = 24 * 60 * 60 * 1000

const CONTROL_CHARACTERS = /\p{Cc}/u

/** Stored personal token, without its hash */
export interface ApiToken {
  id: number
  owner: string
  name: string
  scope: ApiTokenScope
  prefix: string // first characters of the secret, shown to recognise a token
  createdAt: string
  expiresAt: string | null // null only on tokens created before expiry became mandatory, never live
  lastUsedAt: string | null
  revokedAt: string | null
  revokedBy: string | null
}

/** Validated input of a new token */
export interface ApiTokenInput {
  name: string
  scope: ApiTokenScope
  expiresAt: string
}

export type TokenValidation =
  | { ok: true; value: ApiTokenInput }
  | { ok: false; errors: ValidationIssue[] }

/**
 * Returns the MCP scopes a token scope grants.
 * @param {ApiTokenScope} scope - Token scope
 * @returns {ApiTokenGrant[]} - Granted scopes, read always included
 */
export const scopesOf = (scope: ApiTokenScope): ApiTokenGrant[] =>
  scope === 'propose' ? ['sieb:read', 'sieb:propose'] : ['sieb:read']

/**
 * Returns whether a token can authenticate at a point in time: not revoked and not expired. A
 * token without expiry is never live.
 * @param {Pick<ApiToken, 'revokedAt' | 'expiresAt'>} token - Token
 * @param {Date} now - Current time
 * @returns {boolean} - True when live
 */
export const isTokenLive = (token: Pick<ApiToken, 'revokedAt' | 'expiresAt'>, now: Date): boolean =>
  token.revokedAt === null &&
  token.expiresAt !== null &&
  Date.parse(token.expiresAt) > now.getTime()

/**
 * Reads a token name: trimmed, 1 to MAX_TOKEN_NAME_LENGTH characters, no control characters.
 * @param {unknown} value - Raw name
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {string | null} - Name, null when invalid
 */
const readName = (value: unknown, errors: ValidationIssue[]): string | null => {
  const name = typeof value === 'string' ? value.trim() : ''

  if (name === '') {
    errors.push({ field: 'name', code: typeof value === 'string' ? 'required' : 'invalid' })
    return null
  }

  if (name.length > MAX_TOKEN_NAME_LENGTH) {
    errors.push({ field: 'name', code: 'too_long' })
    return null
  }

  if (CONTROL_CHARACTERS.test(name)) {
    errors.push({ field: 'name', code: 'invalid' })
    return null
  }

  return name
}

/**
 * Validates the body of a new token. The expiry is required and never null: a date-time or date
 * in the future (decision expiry rules) at most MAX_TOKEN_DAYS ahead, too_far beyond that.
 * @param {Record<string, unknown>} raw - Parsed request body
 * @param {Date} now - Current time
 * @returns {TokenValidation} - Validated input or the list of errors
 */
export const validateTokenInput = (raw: Record<string, unknown>, now: Date): TokenValidation => {
  const errors: ValidationIssue[] = []
  const name = readName(raw.name, errors)
  const scope = (API_TOKEN_SCOPES as readonly unknown[]).includes(raw.scope)
    ? (raw.scope as ApiTokenScope)
    : null
  const expiryErrors: DecisionInputError[] = []
  const expiresAt = readExpiry(raw.expiresAt, now, expiryErrors)

  if (scope === null) {
    errors.push({ field: 'scope', code: raw.scope === undefined ? 'required' : 'invalid' })
  }

  if (raw.expiresAt === undefined || raw.expiresAt === null) {
    errors.push({ field: 'expiresAt', code: 'required' })
  }

  errors.push(...expiryErrors)

  if (
    typeof expiresAt === 'string' &&
    expiryErrors.length === 0 &&
    Date.parse(expiresAt) > now.getTime() + (MAX_TOKEN_DAYS + 1) * DAY_MS
  ) {
    errors.push({ field: 'expiresAt', code: 'too_far' })
  }

  if (
    errors.length > 0 ||
    name === null ||
    scope === null ||
    expiresAt === undefined ||
    expiresAt === null
  ) {
    return { ok: false, errors }
  }

  return { ok: true, value: { name, scope, expiresAt } }
}
