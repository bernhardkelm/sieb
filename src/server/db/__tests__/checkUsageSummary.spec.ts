// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { CheckUsage, WorkerResult } from '#core/check.ts'
import { checkFixture, START, type CheckFixture } from '#server/checks/__tests__/checkFixtures.ts'
import { cancelForUser, queueForUser } from '#server/checks/userCommands.ts'
import { claimForWorker, recordResult } from '#server/checks/workerCommands.ts'
import { readCheckUsageSummary } from '#server/db/checkUsageSummary.ts'

const DAY = 24 * 60 * 60 * 1000

/**
 * Builds a usage report.
 * @param {Partial<CheckUsage>} overrides - Fields to set
 * @returns {CheckUsage} - Usage
 */
const usage = (overrides: Partial<CheckUsage> = {}): CheckUsage => ({
  inputTokens: 1000,
  outputTokens: 200,
  cacheReadTokens: 50,
  cacheCreationTokens: 25,
  costUsd: 0.5,
  turns: 3,
  ...overrides,
})

/**
 * Queues, claims and ends one check of a finding.
 * @param {CheckFixture} fixture - Check fixture
 * @param {number} findingId - Finding id
 * @param {Partial<WorkerResult>} result - Result fields to set
 * @returns {void}
 */
const runCheck = (
  { context, advance }: CheckFixture,
  findingId: number,
  result: Partial<WorkerResult>,
): void => {
  queueForUser(context, 'alice', [findingId])
  const id = claimForWorker(context)?.checkId ?? 0

  advance(10_000)
  recordResult(context, id, {
    status: 'done',
    error: null,
    durationMs: 1000,
    usage: null,
    reply: null,
    ...result,
  })
}

describe('readCheckUsageSummary', () => {
  it('sums the ended checks of each window, averages the done and failed durations', () => {
    const fixture = checkFixture()
    const { context, db, findings, advance } = fixture

    runCheck(fixture, findings.nginx, { durationMs: 4000, usage: usage() })
    runCheck(fixture, findings.nginx, { status: 'failed', error: 'boom', durationMs: 6000 })
    const [queued] = queueForUser(context, 'bob', [findings.redis]).queued

    cancelForUser(context, 'bob', queued?.id ?? 0)
    advance(8 * DAY)
    runCheck(fixture, findings.nginx, {
      durationMs: 1000,
      usage: usage({ inputTokens: 10, outputTokens: 1, costUsd: null }),
    })

    expect(readCheckUsageSummary(db, context.clock())).toEqual({
      last7Days: {
        days: 7,
        checks: 1,
        withUsage: 1,
        inputTokens: 10,
        outputTokens: 1,
        cacheTokens: 75,
        costUsd: null,
        averageDurationMs: 1000,
      },
      last30Days: {
        days: 30,
        checks: 4,
        withUsage: 2,
        inputTokens: 1010,
        outputTokens: 201,
        cacheTokens: 150,
        costUsd: 0.5,
        averageDurationMs: 3667,
      },
    })
  })

  it('falls back to start and end without a reported duration and is empty without checks', () => {
    const { db, findings } = checkFixture()

    expect(readCheckUsageSummary(db, START).last7Days).toEqual({
      days: 7,
      checks: 0,
      withUsage: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheTokens: 0,
      costUsd: null,
      averageDurationMs: null,
    })

    db.prepare(
      `INSERT INTO checks (finding_id, vuln_id, image_ref, requested_by, state, created_at,
         started_at, heartbeat_at, finished_at, error)
       VALUES (?, 'CVE-2025-1000', 'index.docker.io/library/nginx', 'alice', 'failed', ?, ?, ?, ?,
         'Timed out')`,
    ).run(
      findings.nginx,
      new Date(START.getTime() - 120_000).toISOString(),
      new Date(START.getTime() - 90_000).toISOString(),
      new Date(START.getTime() - 90_000).toISOString(),
      new Date(START.getTime() - 60_000).toISOString(),
    )

    expect(readCheckUsageSummary(db, START).last7Days).toMatchObject({
      checks: 1,
      withUsage: 0,
      averageDurationMs: 30_000,
    })
  })
})
