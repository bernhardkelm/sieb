// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { OAuthError } from '@modelcontextprotocol/server'

import type { ApiTokenInput } from '#core/apiToken.ts'
import { createPersonalTokenVerifier } from '#server/auth/personalTokenVerifier.ts'
import {
  displayPrefixOf,
  generateTokenSecret,
  hashesMatch,
  hashTokenSecret,
  isTokenSecret,
} from '#server/auth/tokenSecrets.ts'
import {
  findTokenByHash,
  insertToken,
  listOwnTokens,
  revokeOwnToken,
} from '#server/db/apiTokenRepository.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'

const NOW = new Date('2026-06-01T12:00:00.000Z')
const RESOURCE = new URL('https://sieb.example.com/mcp')

type LegacyTokenInput = Omit<ApiTokenInput, 'expiresAt'> & { expiresAt: string | null }

/**
 * Opens a database with one token of alice, expiring 2026-07-01 unless overridden; a null expiry
 * stores a token as created before expiry became mandatory.
 * @param {Partial<LegacyTokenInput>} input - Token input overrides
 * @returns {{ db: ReturnType<typeof openDatabase>; secret: string; id: number }} - Database, secret and token id
 */
const withToken = (
  input: Partial<LegacyTokenInput> = {},
): { db: ReturnType<typeof openDatabase>; secret: string; id: number } => {
  const db = openDatabase(MEMORY_DB)
  const secret = generateTokenSecret()
  const result = insertToken(
    db,
    {
      owner: 'alice',
      input: {
        name: 'laptop',
        scope: 'read',
        expiresAt: '2026-07-01T00:00:00.000Z',
        ...input,
      } as ApiTokenInput,
      prefix: displayPrefixOf(secret),
      hash: hashTokenSecret(secret),
    },
    NOW,
  )

  if (!result.ok) {
    throw new Error('insert failed')
  }

  return { db, secret, id: result.token.id }
}

/**
 * Runs the verifier at a point in time and returns the refusal message.
 * @param {ReturnType<typeof openDatabase>} db - Database
 * @param {string} token - Bearer value
 * @param {Date} now - Verification time
 * @returns {Promise<string | null>} - Error code and message, null when accepted
 */
const refusal = async (
  db: ReturnType<typeof openDatabase>,
  token: string,
  now = NOW,
): Promise<string | null> => {
  try {
    await createPersonalTokenVerifier({ db, clock: () => now })(token, RESOURCE)
    return null
  } catch (error) {
    return error instanceof OAuthError ? `${error.code}: ${error.message}` : String(error)
  }
}

describe('token secrets', () => {
  it('generates sieb_ secrets of 32 random bytes and hashes them as sha-256 hex', () => {
    const secret = generateTokenSecret()

    expect(secret).toMatch(/^sieb_[A-Za-z0-9_-]{43}$/)
    expect(isTokenSecret(secret)).toBe(true)
    expect(generateTokenSecret()).not.toBe(secret)
    expect(displayPrefixOf(secret)).toBe(secret.slice(0, 13))
    expect(hashTokenSecret('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(hashTokenSecret(secret)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashesMatch(hashTokenSecret(secret), hashTokenSecret(secret))).toBe(true)
    expect(hashesMatch(hashTokenSecret(secret), hashTokenSecret('sieb_other'))).toBe(false)
    expect(hashesMatch('short', 'short')).toBe(false)
  })
})

describe('personal token verifier', () => {
  it('accepts a live token as its owner and records the use once a minute', async () => {
    const { db, secret, id } = withToken({ scope: 'propose' })
    const verify = createPersonalTokenVerifier({ db, clock: () => NOW })

    expect(await verify(secret, RESOURCE)).toEqual({
      token: secret,
      clientId: `sieb-token-${id}`,
      scopes: ['sieb:read', 'sieb:propose'],
      expiresAt: Date.parse('2026-07-01T00:00:00.000Z') / 1000,
      resource: RESOURCE,
      extra: { actor: 'alice', via: 'token', tokenId: id, clientLabel: 'laptop' },
    })
    expect(listOwnTokens(db, 'alice')[0]?.lastUsedAt).toBe(NOW.toISOString())

    const later = new Date(NOW.getTime() + 30_000)
    await createPersonalTokenVerifier({ db, clock: () => later })(secret, RESOURCE)

    expect(listOwnTokens(db, 'alice')[0]?.lastUsedAt).toBe(NOW.toISOString())

    const muchLater = new Date(NOW.getTime() + 61_000)
    await createPersonalTokenVerifier({ db, clock: () => muchLater })(secret, RESOURCE)

    expect(listOwnTokens(db, 'alice')[0]?.lastUsedAt).toBe(muchLater.toISOString())
  })

  it('finds a token by the hash of its secret only', () => {
    const { db, secret, id } = withToken()

    expect(findTokenByHash(db, hashTokenSecret(secret))?.id).toBe(id)
    expect(findTokenByHash(db, hashTokenSecret(`${secret}x`))).toBeNull()
  })

  it('reports the expiry of an expiring token in seconds', async () => {
    const { db, secret } = withToken({ expiresAt: '2026-07-01T00:00:00.000Z' })
    const info = await createPersonalTokenVerifier({ db, clock: () => NOW })(secret, RESOURCE)

    expect(info.expiresAt).toBe(Date.parse('2026-07-01T00:00:00.000Z') / 1000)
  })

  it('refuses a token without expiry, from before expiry became mandatory', async () => {
    const { db, secret } = withToken({ expiresAt: null })

    await expect(
      createPersonalTokenVerifier({ db, clock: () => NOW })(secret, RESOURCE),
    ).rejects.toMatchObject({ code: 'invalid_token' })
    expect(listOwnTokens(db, 'alice')[0]?.lastUsedAt).toBeNull()
  })

  it('refuses unknown, malformed, revoked and expired tokens', async () => {
    const { db, secret, id } = withToken({ expiresAt: '2026-07-01T00:00:00.000Z' })

    expect(await refusal(db, generateTokenSecret())).toBe('invalid_token: Unknown token')
    expect(await refusal(db, 'sieb_short')).toBe('invalid_token: Unknown token')
    expect(await refusal(db, secret, new Date('2026-07-01T00:00:00.000Z'))).toBe(
      'invalid_token: Token revoked or expired',
    )

    revokeOwnToken(db, 'alice', id, NOW)

    expect(await refusal(db, secret)).toBe('invalid_token: Token revoked or expired')
  })
})
