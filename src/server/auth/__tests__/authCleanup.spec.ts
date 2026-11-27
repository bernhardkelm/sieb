// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { buildProposalInput, PROPOSER } from '#core/__tests__/proposalBuilders.ts'
import { startAuthCleanup } from '#server/auth/authCleanup.ts'
import { listOwnTokens } from '#server/db/apiTokenRepository.ts'
import { insertToken } from '#server/db/storeApiToken.ts'
import {
  deleteStaleTokens,
  revokeLiveTokensOf,
  TOKEN_RETENTION_MS,
} from '#server/db/apiTokenCleanup.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import { getProposal, insertProposal } from '#server/db/proposalRepository.ts'
import { createSession } from '#server/db/sessionRepository.ts'

const NOW = new Date('2026-06-01T12:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Stores a token of an owner.
 * @param {ReturnType<typeof openDatabase>} db - Database
 * @param {string} owner - Owner
 * @param {string} name - Token name, also its hash seed
 * @param {string} expiresAt - Expiry
 * @returns {number} - Token id
 */
const addToken = (
  db: ReturnType<typeof openDatabase>,
  owner: string,
  name: string,
  expiresAt: string,
): number => {
  const result = insertToken(
    db,
    {
      owner,
      input: { name, scope: 'read', expiresAt },
      prefix: 'sieb_abcd',
      hash: name.padEnd(64, '0').slice(0, 64),
    },
    new Date(Date.parse(expiresAt) - 30 * DAY_MS),
  )

  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.token.id
}

describe('api token cleanup', () => {
  it('revokes only the live tokens of the user', () => {
    const db = openDatabase(MEMORY_DB)

    addToken(db, 'mallory', 'aaaa', '2026-07-01T00:00:00.000Z')
    addToken(db, 'mallory', 'bbbb', '2026-05-01T00:00:00.000Z')
    addToken(db, 'alice', 'cccc', '2026-07-01T00:00:00.000Z')

    expect(revokeLiveTokensOf(db, 'mallory', NOW, 'sieb')).toBe(1)
    expect(listOwnTokens(db, 'mallory').map((token) => token.revokedBy)).toEqual(['sieb', null])
    expect(listOwnTokens(db, 'alice')[0]?.revokedAt).toBeNull()
    expect(revokeLiveTokensOf(db, 'mallory', NOW, 'sieb')).toBe(0)
  })

  it('deletes rows revoked or expired more than 90 days ago', () => {
    const db = openDatabase(MEMORY_DB)
    const old = new Date(NOW.getTime() - TOKEN_RETENTION_MS - 1).toISOString()
    const recent = new Date(NOW.getTime() - TOKEN_RETENTION_MS + DAY_MS).toISOString()

    addToken(db, 'alice', 'aaaa', old)
    addToken(db, 'alice', 'bbbb', recent)
    addToken(db, 'alice', 'cccc', '2026-07-01T00:00:00.000Z')
    addToken(db, 'bob', 'dddd', '2026-07-01T00:00:00.000Z')
    revokeLiveTokensOf(db, 'bob', new Date(NOW.getTime() - TOKEN_RETENTION_MS - DAY_MS), 'bob')

    db.prepare(
      `INSERT INTO api_tokens (owner, name, scope, token_prefix, token_hash, created_at)
       VALUES ('alice', 'legacy-old', 'read', 'sieb_x', ?, ?), ('alice', 'legacy-new', 'read', 'sieb_y', ?, ?)`,
    ).run('e'.repeat(64), old, 'f'.repeat(64), recent)

    expect(revokeLiveTokensOf(db, 'alice', NOW, 'sieb')).toBe(1)
    db.prepare(
      "UPDATE api_tokens SET revoked_at = NULL, revoked_by = NULL WHERE name = 'cccc'",
    ).run()
    expect(deleteStaleTokens(db, NOW)).toBe(3)
    expect(
      listOwnTokens(db, 'alice')
        .map((token) => token.name)
        .sort(),
    ).toEqual(['bbbb', 'cccc', 'legacy-new'])
    expect(listOwnTokens(db, 'bob')).toEqual([])
  })
})

describe('api token cleanup with proposals', () => {
  it('deletes an old token that proposals name and keeps their attribution', () => {
    const db = openDatabase(MEMORY_DB)
    const old = new Date(NOW.getTime() - TOKEN_RETENTION_MS - 1).toISOString()
    const tokenId = addToken(db, 'alice', 'aaaa', old)
    const proposalId = insertProposal(db, {
      ...buildProposalInput(),
      ...PROPOSER,
      proposedBy: 'alice',
      tokenId,
      sourceAccess: [],
      basisDecisions: [],
      createdAt: old,
    })

    expect(deleteStaleTokens(db, NOW)).toBe(1)
    expect(listOwnTokens(db, 'alice')).toEqual([])
    expect(getProposal(db, proposalId)).toMatchObject({
      proposedBy: 'alice',
      proposedVia: 'token',
      clientLabel: PROPOSER.clientLabel,
      tokenId,
    })
    expect(addToken(db, 'bob', 'bbbb', '2026-07-01T00:00:00.000Z')).toBe(tokenId + 1)
  })
})

describe('startAuthCleanup', () => {
  it('cleans sessions and tokens now and on every tick and logs the counts', () => {
    vi.useFakeTimers()
    const db = openDatabase(MEMORY_DB)
    const now = { ms: NOW.getTime() }
    const logs: string[] = []
    const session = { username: 'alice', groups: [], idToken: 'jwt' }

    createSession(db, session, new Date(now.ms - 2000), 1000)
    createSession(db, session, new Date(now.ms), 60_000)
    addToken(db, 'alice', 'aaaa', new Date(now.ms - TOKEN_RETENTION_MS - 1).toISOString())
    const cleanup = startAuthCleanup({
      db,
      clock: () => new Date(now.ms),
      log: (line) => logs.push(line),
      intervalMs: 30_000,
    })

    expect(logs).toEqual([
      '[sieb] session cleanup removed 1 expired sessions',
      '[sieb] token cleanup removed 1 revoked or expired tokens',
    ])
    now.ms += 60_000
    vi.advanceTimersByTime(30_000)
    expect(logs).toHaveLength(3)
    vi.advanceTimersByTime(30_000)
    expect(logs).toHaveLength(3)
    cleanup.stop()
    vi.useRealTimers()
  })
})
