// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { DatabaseSync } from 'node:sqlite'

import { mcpLastSeenAt } from '#server/db/mcpConnectionRepository.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import {
  CONNECTION_RECORD_INTERVAL_MS,
  createConnectionRecorder,
} from '#server/mcp/connectionRecorder.ts'
import type { McpCaller } from '#server/mcp/mcpCaller.ts'

const START = Date.parse('2026-06-01T12:00:00.000Z')

const OAUTH_ALICE: McpCaller = {
  actor: 'alice',
  via: 'oauth',
  tokenId: null,
  clientLabel: 'claude.ai',
  scopes: ['sieb:read'],
}
const TOKEN_ALICE: McpCaller = { ...OAUTH_ALICE, via: 'token', tokenId: 1, clientLabel: 'laptop' }
const OAUTH_BOB: McpCaller = { ...OAUTH_ALICE, actor: 'bob' }

interface RecorderSetup {
  db: DatabaseSync
  record: (caller: McpCaller) => void
  at: (ms: number) => void // moves the clock to START plus ms
  logs: string[]
}

/**
 * Creates a recorder over a fresh database with a settable clock and collected log lines.
 * @returns {RecorderSetup} - Database, recorder, clock setter and log
 */
const setup = (): RecorderSetup => {
  const db = openDatabase(MEMORY_DB)
  const logs: string[] = []
  let now = START
  const record = createConnectionRecorder({
    db,
    clock: () => new Date(now),
    log: (line) => logs.push(line),
  })

  return {
    db,
    record,
    at: (ms: number) => {
      now = START + ms
    },
    logs,
  }
}

describe('connection recorder', () => {
  it('writes each user and kind at most once per interval', () => {
    const { db, record, at } = setup()

    record(OAUTH_ALICE)
    at(CONNECTION_RECORD_INTERVAL_MS - 1)
    record(OAUTH_ALICE)

    expect(mcpLastSeenAt(db, 'alice', 'oauth')).toBe('2026-06-01T12:00:00.000Z')

    at(CONNECTION_RECORD_INTERVAL_MS)
    record(OAUTH_ALICE)

    expect(mcpLastSeenAt(db, 'alice', 'oauth')).toBe('2026-06-01T12:05:00.000Z')
  })

  it('throttles token and OAuth callers and users separately', () => {
    const { db, record, at } = setup()

    record(OAUTH_ALICE)
    at(1000)
    record(TOKEN_ALICE)
    record(OAUTH_BOB)

    expect(mcpLastSeenAt(db, 'alice', 'oauth')).toBe('2026-06-01T12:00:00.000Z')
    expect(mcpLastSeenAt(db, 'alice', 'token')).toBe('2026-06-01T12:00:01.000Z')
    expect(mcpLastSeenAt(db, 'bob', 'oauth')).toBe('2026-06-01T12:00:01.000Z')
    expect(mcpLastSeenAt(db, 'bob', 'token')).toBeNull()
  })

  it('logs a failed write instead of throwing and retries on the next request', () => {
    const { db, record, logs } = setup()

    db.exec('ALTER TABLE mcp_connections RENAME TO mcp_connections_gone')

    expect(() => record(OAUTH_ALICE)).not.toThrow()
    expect(logs).toEqual([expect.stringMatching(/^\[sieb\] could not record the MCP connection: /)])

    db.exec('ALTER TABLE mcp_connections_gone RENAME TO mcp_connections')
    record(OAUTH_ALICE)

    expect(mcpLastSeenAt(db, 'alice', 'oauth')).toBe('2026-06-01T12:00:00.000Z')
  })
})
