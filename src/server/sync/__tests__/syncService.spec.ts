// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { createDecision } from '#server/db/createDecision.ts'
import { listDecisionEvents } from '#server/db/decisionEventRepository.ts'
import { countOpenFindings } from '#server/db/findingRepository.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import { startSyncRun } from '#server/db/syncRunRepository.ts'
import { createSyncService } from '#server/sync/syncService.ts'

import { buildSnapshot, NGINX } from '#server/db/__tests__/dbFixtures.ts'

import { queuedSource, quiet } from './syncFixtures.ts'

const NOW = new Date('2026-06-01T00:00:00.000Z')

describe('createSyncService', () => {
  it('records successful runs with counts and failed runs without resolving anything', async () => {
    const db = openDatabase(MEMORY_DB)
    const source = queuedSource([buildSnapshot([{}]), new Error('kubectl timed out')])
    const sync = createSyncService({ db, source, clock: () => NOW, log: quiet })

    expect(await sync.syncNow()).toMatchObject({
      id: 1,
      status: 'success',
      fetchedAt: '2026-06-01T00:00:00.000Z',
      counts: { findingsNew: 1, decisionEvents: 0 },
    })
    expect(await sync.syncNow()).toMatchObject({
      id: 2,
      status: 'failed',
      error: 'kubectl timed out',
      counts: null,
    })
    expect(countOpenFindings(db)).toBe(1)
    expect(sync.latestRun()?.id).toBe(2)
  })

  it('joins a running sync instead of starting a second one', async () => {
    const db = openDatabase(MEMORY_DB)
    const sync = createSyncService({
      db,
      source: queuedSource([buildSnapshot([{}])]),
      clock: () => NOW,
      log: quiet,
    })
    const first = sync.syncNow()
    const second = sync.syncNow()

    expect(sync.isRunning()).toBe(true)
    expect(second).toBe(first)
    expect((await first).status).toBe('success')
    expect(sync.isRunning()).toBe(false)
  })

  it('marks runs interrupted by a previous process as failed', () => {
    const db = openDatabase(MEMORY_DB)
    startSyncRun(db, 'mock', NOW)

    const sync = createSyncService({ db, source: queuedSource([]), clock: () => NOW, log: quiet })

    expect(sync.latestRun()).toMatchObject({ status: 'failed', error: 'interrupted' })
  })

  it('writes reopened events once when a decided finding rises', async () => {
    const db = openDatabase(MEMORY_DB)
    const source = queuedSource([
      buildSnapshot([{ severity: 'Medium' }]),
      buildSnapshot([{ severity: 'Critical' }]),
      buildSnapshot([{ severity: 'Critical' }]),
    ])
    const sync = createSyncService({ db, source, clock: () => NOW, log: quiet })

    await sync.syncNow()
    createDecision(
      db,
      {
        vulnId: 'CVE-2025-1000',
        scope: 'image',
        imageRef: NGINX,
        status: 'not_affected',
        justification: null,
        reason: 'x',
        expiresAt: null,
      },
      'dev',
      NOW,
    )

    expect((await sync.syncNow()).counts?.decisionEvents).toBe(1)
    expect((await sync.syncNow()).counts?.decisionEvents).toBe(0)
    expect(
      listDecisionEvents(db, [1]).map((event) => [event.type, event.actor, event.payload]),
    ).toEqual([
      ['created', 'dev', expect.any(Object)],
      [
        'reopened',
        'sieb',
        {
          reason: 'severity_rose',
          imageRef: NGINX,
          severity: 'Critical',
          kev: false,
          baselineSeverity: 'Medium',
          baselineKev: false,
        },
      ],
    ])
  })

  it('rolls a snapshot back that fails midway and records the run as failed', async () => {
    const db = openDatabase(MEMORY_DB)
    const broken = buildSnapshot([
      { vulnId: 'CVE-2025-1' },
      { vulnId: 'CVE-2025-2', severity: 'Bogus' as never },
    ])
    const sync = createSyncService({
      db,
      source: queuedSource([buildSnapshot([{}]), broken]),
      clock: () => NOW,
      log: quiet,
    })

    await sync.syncNow()

    expect(await sync.syncNow()).toMatchObject({
      status: 'failed',
      error: expect.stringMatching(/CHECK/),
    })
    expect(db.prepare('SELECT vuln_id, resolved_at FROM findings ORDER BY id').all()).toEqual([
      { vuln_id: 'CVE-2025-1000', resolved_at: null },
    ])
  })

  it('records a run as failed and keeps its snapshot out when the success cannot be recorded', async () => {
    const db = openDatabase(MEMORY_DB)
    const lines: string[] = []
    const sync = createSyncService({
      db,
      source: queuedSource([buildSnapshot([{}])]),
      clock: () => NOW,
      log: (line) => lines.push(line),
    })

    db.exec(`CREATE TRIGGER no_success BEFORE UPDATE ON sync_runs WHEN NEW.status = 'success'
      BEGIN SELECT RAISE(ABORT, 'disk full'); END`)

    expect(await sync.syncNow()).toMatchObject({ status: 'failed', error: 'disk full' })
    expect(countOpenFindings(db)).toBe(0)
    expect(lines.some((line) => line.includes('failed: disk full'))).toBe(true)
  })

  it('rejects instead of throwing unhandled when no run can be recorded', async () => {
    const db = openDatabase(MEMORY_DB)
    const lines: string[] = []
    const sync = createSyncService({
      db,
      source: queuedSource([buildSnapshot([{}])]),
      clock: () => NOW,
      log: (line) => lines.push(line),
    })

    db.exec(`CREATE TRIGGER no_runs BEFORE INSERT ON sync_runs
      BEGIN SELECT RAISE(ABORT, 'read-only'); END`)

    await expect(sync.syncNow()).rejects.toThrow(/read-only/)
    expect(sync.isRunning()).toBe(false)
    expect(lines).toEqual(['[sieb] sync from mock could not start: read-only'])
  })
})
