// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { checkFixture } from '#server/checks/__tests__/checkFixtures.ts'
import { cancelForUser, queueForUser } from '#server/checks/userCommands.ts'
import { claimForWorker, recordResult } from '#server/checks/workerCommands.ts'
import { readCheckMetrics } from '#server/db/readCheckMetrics.ts'

describe('readCheckMetrics', () => {
  it('counts the checks per state and sums the done and failed durations', () => {
    const { context, db, findings, advance } = checkFixture()

    expect(readCheckMetrics(db, null)).toEqual({
      open: { queued: 0, running: 0 },
      finished: { done: 0, failed: 0, cancelled: 0 },
      durationSecondsSum: 0,
      durationCount: 0,
      workerOnline: null,
    })

    queueForUser(context, 'alice', [findings.nginx])
    const first = claimForWorker(context)?.checkId ?? 0

    advance(5000)
    recordResult(context, first, {
      status: 'done',
      error: null,
      durationMs: 4500,
      usage: null,
      reply: null,
    })
    queueForUser(context, 'alice', [findings.nginx])
    const second = claimForWorker(context)?.checkId ?? 0

    advance(20_000)
    recordResult(context, second, {
      status: 'failed',
      error: 'boom',
      durationMs: 20_000,
      usage: null,
      reply: null,
    })
    const [cancelled] = queueForUser(context, 'bob', [findings.redis]).queued

    cancelForUser(context, 'bob', cancelled?.id ?? 0)
    queueForUser(context, 'alice', [findings.nginx, findings.redis])
    claimForWorker(context)

    expect(readCheckMetrics(db, true)).toEqual({
      open: { queued: 1, running: 1 },
      finished: { done: 1, failed: 1, cancelled: 1 },
      durationSecondsSum: 24.5,
      durationCount: 2,
      workerOnline: true,
    })
  })
})
