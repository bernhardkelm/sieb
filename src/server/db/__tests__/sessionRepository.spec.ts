// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import {
  createSession,
  deleteExpiredSessions,
  deleteSession,
  findSession,
  SESSION_TOUCH_INTERVAL_MS,
} from '#server/db/sessionRepository.ts'
import { hashSessionId } from '#server/db/sessionRows.ts'

const NOW = new Date('2026-06-01T12:00:00.000Z')
const HOUR_MS = 60 * 60 * 1000
const ALICE = { username: 'alice', groups: ['sieb-users'], idToken: 'header.payload.sig' }

/**
 * Returns a time relative to NOW.
 * @param {number} ms - Offset in milliseconds
 * @returns {Date} - Time
 */
const at = (ms: number): Date => new Date(NOW.getTime() + ms)

describe('sessionRepository', () => {
  it('creates a session stored only under the sha-256 of its random id', () => {
    const db = openDatabase(MEMORY_DB)
    const id = createSession(db, ALICE, NOW, 12 * HOUR_MS)
    const other = createSession(db, ALICE, NOW, 12 * HOUR_MS)
    const rows = db.prepare('SELECT id_hash FROM sessions').all()

    expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(other).not.toBe(id)
    expect(rows.map((row) => row.id_hash)).toContain(hashSessionId(id))
    expect(JSON.stringify(rows)).not.toContain(id)
    expect(findSession(db, id, NOW)).toEqual({
      idHash: hashSessionId(id),
      username: 'alice',
      groups: ['sieb-users'],
      createdAt: NOW.toISOString(),
      lastSeenAt: NOW.toISOString(),
      expiresAt: at(12 * HOUR_MS).toISOString(),
      idToken: 'header.payload.sig',
    })
  })

  it('returns null for unknown and malformed ids', () => {
    const db = openDatabase(MEMORY_DB)
    const id = createSession(db, ALICE, NOW, HOUR_MS)

    expect(findSession(db, 'A'.repeat(43), NOW)).toBeNull()
    expect(findSession(db, hashSessionId(id), NOW)).toBeNull()
    expect(findSession(db, `${id}x`, NOW)).toBeNull()
    expect(findSession(db, '', NOW)).toBeNull()
    expect(deleteSession(db, "' OR 1=1 --")).toBeNull()
    expect(findSession(db, id, NOW)).not.toBeNull()
  })

  it('expires at the absolute lifetime however often the session is used and deletes it on lookup', () => {
    const db = openDatabase(MEMORY_DB)
    const id = createSession(db, ALICE, NOW, 2 * HOUR_MS)

    for (let minute = 0; minute < 120; minute += 10) {
      expect(findSession(db, id, at(minute * 60 * 1000))?.expiresAt).toBe(
        at(2 * HOUR_MS).toISOString(),
      )
    }

    expect(findSession(db, id, at(2 * HOUR_MS - 1))).not.toBeNull()
    expect(findSession(db, id, at(2 * HOUR_MS))).toBeNull()
    expect(db.prepare('SELECT COUNT(*) AS n FROM sessions').get()?.n).toBe(0)
  })

  it('touches last_seen_at at most once per interval', () => {
    const db = openDatabase(MEMORY_DB)
    const id = createSession(db, ALICE, NOW, HOUR_MS)
    /**
     * Reads the stored last_seen_at.
     * @returns {unknown} - Value
     */
    const stored = (): unknown =>
      db.prepare('SELECT last_seen_at FROM sessions').get()?.last_seen_at

    findSession(db, id, at(SESSION_TOUCH_INTERVAL_MS - 1))
    expect(stored()).toBe(NOW.toISOString())

    expect(findSession(db, id, at(SESSION_TOUCH_INTERVAL_MS))?.lastSeenAt).toBe(
      at(SESSION_TOUCH_INTERVAL_MS).toISOString(),
    )
    expect(stored()).toBe(at(SESSION_TOUCH_INTERVAL_MS).toISOString())

    findSession(db, id, at(SESSION_TOUCH_INTERVAL_MS + 30_000))
    expect(stored()).toBe(at(SESSION_TOUCH_INTERVAL_MS).toISOString())
  })

  it('deletes a session and returns it for the logout hint', () => {
    const db = openDatabase(MEMORY_DB)
    const id = createSession(db, ALICE, NOW, HOUR_MS)

    expect(deleteSession(db, id)?.idToken).toBe('header.payload.sig')
    expect(deleteSession(db, id)).toBeNull()
    expect(findSession(db, id, NOW)).toBeNull()
  })

  it('cleans up expired sessions only', () => {
    const db = openDatabase(MEMORY_DB)
    const short = createSession(db, ALICE, NOW, HOUR_MS)
    const long = createSession(db, { ...ALICE, username: 'bob' }, NOW, 3 * HOUR_MS)

    expect(deleteExpiredSessions(db, at(HOUR_MS - 1))).toBe(0)
    expect(deleteExpiredSessions(db, at(2 * HOUR_MS))).toBe(1)
    expect(findSession(db, short, at(30 * 60 * 1000))).toBeNull()
    expect(findSession(db, long, at(2 * HOUR_MS))?.username).toBe('bob')
  })
})
