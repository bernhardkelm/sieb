// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { startAuthCleanup } from '#server/auth/authCleanup.ts'
import {
  deleteStaleSeenMarks,
  INBOX_SEEN_MAX_PER_USER,
  INBOX_SEEN_RETENTION_MS,
  listInboxFindings,
  markSeen,
  readSeenMarks,
} from '#server/db/inboxRepository.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import { applySnapshot } from '#server/sync/applySnapshot.ts'

import { buildSnapshot, NGINX, REDIS } from './dbFixtures.ts'

const NOW = new Date('2026-06-01T12:00:00.000Z')

describe('inbox repository', () => {
  it('lists open findings with kev_since, labels, packages and namespaces', () => {
    const db = openDatabase(MEMORY_DB)

    applySnapshot(
      db,
      buildSnapshot(
        [
          { imageRef: NGINX, title: 'overflow' },
          { imageRef: REDIS, vulnId: 'CVE-2025-2000' },
        ],
        ['CVE-2025-1000'],
      ),
      NOW,
      { initialImport: false },
    )
    applySnapshot(
      db,
      buildSnapshot([{ imageRef: NGINX, title: 'overflow' }], ['CVE-2025-1000']),
      NOW,
    )

    expect(listInboxFindings(db)).toEqual([
      {
        id: 1,
        vulnId: 'CVE-2025-1000',
        imageRef: NGINX,
        severity: 'High',
        kev: true,
        title: 'overflow',
        resolvedAt: null,
        kevSince: NOW.toISOString(),
        exposure: 'internal',
        owner: 'third-party',
        packages: ['libssl3'],
        namespaces: ['shop'],
      },
    ])
  })

  it('stores seen marks per user, marking again moves seen_at', () => {
    const db = openDatabase(MEMORY_DB)
    const later = new Date(NOW.getTime() + 1000)

    markSeen(db, 'alice', ['kev:1', 'kev:2'], NOW)
    markSeen(db, 'alice', ['kev:1'], later)
    markSeen(db, 'bob', ['kev:3'], NOW)

    expect(readSeenMarks(db, 'alice')).toEqual(
      new Map([
        ['kev:1', later.toISOString()],
        ['kev:2', NOW.toISOString()],
      ]),
    )
    expect([...readSeenMarks(db, 'bob').keys()]).toEqual(['kev:3'])
    expect(readSeenMarks(db, 'carol').size).toBe(0)
  })

  it('keeps only the newest marks of a user beyond the cap', () => {
    const db = openDatabase(MEMORY_DB)
    const later = new Date(NOW.getTime() + 1000)

    markSeen(db, 'bob', ['kev:9'], NOW, 2)
    markSeen(db, 'alice', ['kev:1', 'kev:2'], NOW, 2)
    markSeen(db, 'alice', ['kev:3'], later, 2)

    expect([...readSeenMarks(db, 'alice').keys()].sort()).toEqual(['kev:2', 'kev:3'])
    expect([...readSeenMarks(db, 'bob').keys()]).toEqual(['kev:9'])
    expect(INBOX_SEEN_MAX_PER_USER).toBe(5000)
  })

  it('deletes marks older than 30 days, also in the periodic cleanup', () => {
    const db = openDatabase(MEMORY_DB)
    const logs: string[] = []

    markSeen(db, 'alice', ['kev:1'], new Date(NOW.getTime() - INBOX_SEEN_RETENTION_MS - 1))
    markSeen(db, 'alice', ['kev:2'], new Date(NOW.getTime() - INBOX_SEEN_RETENTION_MS))
    markSeen(db, 'bob', ['kev:1'], new Date(NOW.getTime() - INBOX_SEEN_RETENTION_MS - 1))

    expect(deleteStaleSeenMarks(db, new Date(NOW.getTime() - 1))).toBe(0)
    startAuthCleanup({ db, clock: () => NOW, log: (line) => logs.push(line) }).stop()

    expect(logs).toEqual(['[sieb] inbox cleanup removed 2 old seen marks'])
    expect([...readSeenMarks(db, 'alice').keys()]).toEqual(['kev:2'])
    expect(readSeenMarks(db, 'bob').size).toBe(0)
  })
})
