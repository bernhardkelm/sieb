// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { NO_PULL_REF_ERROR } from '#core/checkPrompt.ts'
import {
  checkFixture,
  DIGEST,
  NGINX,
  REDIS,
  START,
} from '#server/checks/__tests__/checkFixtures.ts'
import { readChecks } from '#server/checks/readChecks.ts'
import { queueForUser } from '#server/checks/userCommands.ts'
import { claimForWorker, recordResult } from '#server/checks/workerCommands.ts'
import { getCheck } from '#server/db/checkRepository.ts'
import { failChecksOf, REFUSED_REQUESTER_ERROR } from '#server/db/failChecksOf.ts'
import { queueChecks } from '#server/db/queueChecks.ts'
import { hashTokenSecret } from '#server/auth/tokenSecrets.ts'
import { findTokenByHash } from '#server/db/apiTokenRepository.ts'

describe('claim skip paths', () => {
  it('fails a queued check whose finding is gone and claims the next', () => {
    const { context, db, findings, logs } = checkFixture()
    const [gone] = queueForUser(context, 'alice', [findings.redis]).queued

    queueForUser(context, 'alice', [findings.nginx])
    db.prepare('DELETE FROM finding_instances WHERE finding_id = ?').run(findings.redis)
    db.prepare('DELETE FROM findings WHERE id = ?').run(findings.redis)

    expect(claimForWorker(context)?.findingId).toBe(findings.nginx)
    expect(getCheck(db, gone?.id ?? 0)).toMatchObject({
      state: 'failed',
      error: 'The finding no longer exists.',
      tokenId: null,
    })
    expect(logs.some((line) => line.includes(`check ${gone?.id} failed (not startable)`))).toBe(
      true,
    )
  })

  it('fails a queued check whose image is no longer public', () => {
    const { context, db, findings } = checkFixture()
    const [check] = queueForUser(context, 'alice', [findings.nginx]).queued

    db.prepare(`UPDATE findings SET owner = 'self' WHERE id = ?`).run(findings.nginx)

    expect(claimForWorker(context)).toBeNull()
    expect(getCheck(db, check?.id ?? 0)).toMatchObject({
      state: 'failed',
      error: 'The image is no longer public.',
    })
  })

  it('fails a check whose image has neither digest nor tag instead of pulling latest', () => {
    const { context, db, findings } = checkFixture()
    const [check] = queueForUser(context, 'alice', [findings.redis]).queued

    db.prepare('UPDATE finding_instances SET image_tag = NULL WHERE finding_id = ?').run(
      findings.redis,
    )

    expect(claimForWorker(context)).toBeNull()
    expect(getCheck(db, check?.id ?? 0)).toMatchObject({
      state: 'failed',
      error: NO_PULL_REF_ERROR,
    })
  })
})

describe('claim pull ref', () => {
  it('pins the scanned digest', () => {
    const { context, findings } = checkFixture()

    queueForUser(context, 'alice', [findings.nginx])

    const claim = claimForWorker(context)

    expect(claim).toMatchObject({ imageRef: `${NGINX}@${DIGEST}`, imageDigest: DIGEST })
    expect(claim?.prompt).not.toContain('may differ')
  })

  it('sends a tag with imageDigest null and warns Claude that it may have moved', () => {
    const { context, findings } = checkFixture()

    queueForUser(context, 'alice', [findings.redis])

    const claim = claimForWorker(context)

    expect(claim).toMatchObject({ imageRef: `${REDIS}:7.4`, imageDigest: null })
    expect(claim?.prompt).toContain(`${REDIS}:7.4 may differ from what Trivy scanned`)
  })

  it('stores the digest the worker reports it pulled', () => {
    const { context, findings } = checkFixture()

    queueForUser(context, 'alice', [findings.redis])

    const id = claimForWorker(context)?.checkId ?? 0

    recordResult(context, id, {
      status: 'done',
      error: null,
      durationMs: 1000,
      usage: null,
      reply: null,
      pulledDigest: DIGEST,
    })

    expect(readChecks(context).recent[0]).toMatchObject({ id, pulledDigest: DIGEST })
  })
})

describe('results of checks that do not run', () => {
  it('answers not_running for a queued and for a timed out check', () => {
    const { context, findings, advance } = checkFixture()
    const result = { status: 'done', error: null, durationMs: 1, usage: null, reply: null } as const

    queueForUser(context, 'alice', [findings.nginx, findings.redis])

    const running = claimForWorker(context)?.checkId ?? 0
    const queued = readChecks(context).queued[0]?.id ?? 0

    expect(recordResult(context, queued, result)).toBe('not_running')
    advance(121_000)
    expect(recordResult(context, running, result)).toBe('not_running')
  })
})

describe('queue cap', () => {
  it('skips findings with queue_full once the open checks reach the cap', () => {
    const { db, context, findings } = checkFixture()
    const request = {
      requestedBy: 'alice',
      publicRegistries: context.publicRegistries,
      maxOpen: 1,
    }

    expect(
      queueChecks(db, { ...request, findingIds: [findings.nginx, findings.redis] }, START).skipped,
    ).toEqual([{ findingId: findings.redis, reason: 'queue_full' }])
    expect(queueChecks(db, { ...request, findingIds: [findings.nginx] }, START).skipped).toEqual([
      { findingId: findings.nginx, reason: 'already_open' },
    ])
    expect(queueChecks(db, { ...request, findingIds: [findings.own] }, START).skipped).toEqual([
      { findingId: findings.own, reason: 'not_public' },
    ])
  })
})

describe('failChecksOf', () => {
  it('fails the open checks of a refused requester and deletes the running token', () => {
    const { context, db, findings } = checkFixture()

    queueForUser(context, 'mallory', [findings.nginx, findings.redis])
    queueForUser(context, 'alice', [findings.own])

    const claim = claimForWorker(context)
    const ended = failChecksOf(db, 'mallory', REFUSED_REQUESTER_ERROR, START)

    expect(ended.map(({ check }) => [check.findingId, check.state, check.error])).toEqual([
      [findings.nginx, 'failed', REFUSED_REQUESTER_ERROR],
      [findings.redis, 'failed', REFUSED_REQUESTER_ERROR],
    ])
    expect(ended[0]?.token?.owner).toBe('mallory')
    expect(findTokenByHash(db, hashTokenSecret(claim?.token ?? ''))).toBeNull()
    expect(failChecksOf(db, 'mallory', REFUSED_REQUESTER_ERROR, START)).toEqual([])
  })
})
