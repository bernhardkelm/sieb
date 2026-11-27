// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { isTokenLive } from '#core/apiToken.ts'
import {
  checkFixture,
  DIGEST,
  insertTokenProposal,
  NGINX,
  PUBLIC_URL,
  REDIS,
  START,
} from '#server/checks/__tests__/checkFixtures.ts'
import { readChecks } from '#server/checks/readChecks.ts'
import { cancelForUser, queueForUser } from '#server/checks/userCommands.ts'
import { claimForWorker, recordHeartbeat, recordResult } from '#server/checks/workerCommands.ts'
import { hashTokenSecret } from '#server/auth/tokenSecrets.ts'
import { findTokenByHash, getOwnToken } from '#server/db/apiTokenRepository.ts'
import { getCheck } from '#server/db/checkRepository.ts'

const USAGE = {
  inputTokens: 1200,
  outputTokens: 300,
  cacheReadTokens: 5000,
  cacheCreationTokens: 800,
  costUsd: 0.42,
  turns: 12,
  models: ['claude-opus-5-5', 'claude-haiku-5'],
}

describe('queueForUser', () => {
  it('queues open findings of public images only and names why others are skipped', () => {
    const { context, findings } = checkFixture()
    const result = queueForUser(context, 'alice', [
      findings.nginx,
      findings.own,
      findings.other,
      findings.resolved,
      9999,
    ])

    expect(result.queued.map((check) => [check.findingId, check.state, check.position])).toEqual([
      [findings.nginx, 'queued', 1],
    ])
    expect(result.queued[0]).toMatchObject({ imageRef: NGINX, requestedBy: 'alice', phase: null })
    expect(result.skipped).toEqual([
      { findingId: findings.own, reason: 'visibility_unknown' },
      { findingId: findings.other, reason: 'not_public' },
      { findingId: findings.resolved, reason: 'resolved' },
      { findingId: 9999, reason: 'not_found' },
    ])
  })

  it('keeps one open check per finding', () => {
    const { context, findings } = checkFixture()

    queueForUser(context, 'alice', [findings.nginx])
    const again = queueForUser(context, 'bob', [findings.nginx, findings.redis])

    expect(again.skipped).toEqual([{ findingId: findings.nginx, reason: 'already_open' }])
    expect(again.queued.map((check) => check.position)).toEqual([2])

    claimForWorker(context)
    expect(queueForUser(context, 'bob', [findings.nginx]).skipped[0]?.reason).toBe('already_open')
  })
})

describe('claimForWorker', () => {
  it('answers null for an empty queue', () => {
    expect(claimForWorker(checkFixture().context)).toBeNull()
  })

  it('claims in FIFO order and runs one check at a time', () => {
    const { context, findings } = checkFixture()

    queueForUser(context, 'alice', [findings.redis])
    queueForUser(context, 'bob', [findings.nginx])

    const first = claimForWorker(context)

    expect(first?.findingId).toBe(findings.redis)
    expect(claimForWorker(context)).toBeNull()

    recordResult(context, first?.checkId ?? 0, {
      status: 'done',
      error: null,
      durationMs: 1000,
      usage: null,
      reply: null,
    })

    expect(claimForWorker(context)?.findingId).toBe(findings.nginx)
  })

  it('mints a propose token of the requester that expires 10 minutes after the timeout', () => {
    const { context, db, findings, logs } = checkFixture({ timeoutSeconds: 600, maxTurns: 40 })

    queueForUser(context, 'alice', [findings.nginx])
    const claim = claimForWorker(context)
    const token = findTokenByHash(db, hashTokenSecret(claim?.token ?? ''))

    expect(token).toMatchObject({
      owner: 'alice',
      name: `Auto-check #${claim?.checkId}`,
      scope: 'propose',
      expiresAt: new Date(START.getTime() + 1200 * 1000).toISOString(),
      revokedAt: null,
    })
    expect(claim).toMatchObject({
      findingId: findings.nginx,
      vulnId: 'CVE-2025-1000',
      imageRef: `${NGINX}@${DIGEST}`,
      mcpUrl: `${PUBLIC_URL}/mcp`,
      timeoutSeconds: 600,
      maxTurns: 40,
    })
    expect(claim?.prompt).toContain(`Triage sieb finding #${findings.nginx}`)
    expect(claim?.prompt).toContain('propose_decision')
    expect(claim?.prompt).toContain('unattended')
    expect(claim?.prompt).toContain('6. Evidence: for every check record what you checked')
    expect(claim?.prompt).toContain('references (http(s) links)')
    expect(getCheck(db, claim?.checkId ?? 0)).toMatchObject({
      state: 'running',
      phase: 'preparing',
      tokenId: token?.id,
    })
    expect(logs.join('\n')).not.toContain(claim?.token)
    expect(logs.some((line) => line.includes(`check ${claim?.checkId} claimed`))).toBe(true)
  })

  it('pulls the tag when no digest is known', () => {
    const { context, findings } = checkFixture()

    queueForUser(context, 'alice', [findings.redis])
    expect(claimForWorker(context)?.imageRef).toBe(`${REDIS}:7.4`)
  })

  it('fails queued checks whose finding was resolved meanwhile and claims the next', () => {
    const { context, db, findings } = checkFixture()
    const [resolving] = queueForUser(context, 'alice', [findings.redis]).queued

    queueForUser(context, 'alice', [findings.nginx])
    db.prepare('UPDATE findings SET resolved_at = ? WHERE id = ?').run('t', findings.redis)

    expect(claimForWorker(context)?.findingId).toBe(findings.nginx)
    expect(getCheck(db, resolving?.id ?? 0)).toMatchObject({
      state: 'failed',
      error: 'The finding was resolved before the check started.',
    })
  })
})

describe('recordHeartbeat', () => {
  it('moves the phase of a running check and refuses one that was cancelled', () => {
    const { context, db, findings } = checkFixture()

    queueForUser(context, 'alice', [findings.nginx])
    const claim = claimForWorker(context)
    const id = claim?.checkId ?? 0

    expect(recordHeartbeat(context, id, 'investigating')).toBe('ok')
    expect(readChecks(context).running?.phase).toBe('investigating')
    expect(cancelForUser(context, 'bob', id)).toBe('cancelled')
    expect(recordHeartbeat(context, id, 'reporting')).toBe('not_running')
    expect(recordHeartbeat(context, 9999, 'reporting')).toBe('not_found')
    expect(findTokenByHash(db, hashTokenSecret(claim?.token ?? ''))).toBeNull()
  })
})

describe('recordResult', () => {
  it('stores usage and reply, links the newest proposal and deletes the token', () => {
    const { context, db, findings } = checkFixture()

    queueForUser(context, 'alice', [findings.nginx])
    const claim = claimForWorker(context)
    const id = claim?.checkId ?? 0
    const tokenId = getCheck(db, id)?.tokenId ?? 0

    insertTokenProposal(db, { tokenId, proposedBy: 'alice', imageRef: REDIS })
    const newest = insertTokenProposal(db, { tokenId, proposedBy: 'alice' })

    expect(
      isTokenLive(getOwnToken(db, 'alice', tokenId) ?? { revokedAt: 'x', expiresAt: null }, START),
    ).toBe(true)
    expect(
      recordResult(context, id, {
        status: 'done',
        error: null,
        durationMs: 90_000,
        usage: USAGE,
        reply: 'Verdict: needs_patch.',
      }),
    ).toBe('ok')

    const [recent] = readChecks(context).recent

    expect(recent).toMatchObject({
      id,
      state: 'done',
      durationMs: 90_000,
      usage: USAGE,
      reply: 'Verdict: needs_patch.',
      proposalId: newest,
      error: null,
    })
    expect(getOwnToken(db, 'alice', tokenId)).toBeNull()
    expect(
      db.prepare('SELECT COUNT(*) AS n FROM decision_proposals WHERE token_id = ?').get(tokenId)?.n,
    ).toBe(2)
    expect(
      recordResult(context, id, {
        status: 'done',
        error: null,
        durationMs: 1,
        usage: null,
        reply: null,
      }),
    ).toBe('not_running')
  })

  it('stores a failure without a proposal', () => {
    const { context, findings } = checkFixture()

    queueForUser(context, 'alice', [findings.nginx])
    const id = claimForWorker(context)?.checkId ?? 0

    recordResult(context, id, {
      status: 'failed',
      error: 'Image export failed.',
      durationMs: 5000,
      usage: null,
      reply: null,
    })

    expect(readChecks(context).recent[0]).toMatchObject({
      state: 'failed',
      error: 'Image export failed.',
      proposalId: null,
    })
  })
})

describe('timeouts', () => {
  it('fails a running check without a heartbeat for 2 minutes and revokes its token', () => {
    const { context, db, findings, advance, logs } = checkFixture()

    queueForUser(context, 'alice', [findings.nginx])
    const claim = claimForWorker(context)

    advance(119_000)
    expect(readChecks(context).running?.id).toBe(claim?.checkId)
    advance(2000)

    const overview = readChecks(context)

    expect(overview.running).toBeNull()
    expect(overview.recent[0]).toMatchObject({ state: 'failed' })
    expect(overview.recent[0]?.error).toMatch(/no heartbeat/)
    expect(findTokenByHash(db, hashTokenSecret(claim?.token ?? ''))).toBeNull()
    expect(recordHeartbeat(context, claim?.checkId ?? 0, 'reporting')).toBe('not_running')
    expect(logs.some((line) => line.includes('failed (timeout)'))).toBe(true)
  })

  it('fails a check that runs past its timeout despite heartbeats', () => {
    const { context, findings, advance } = checkFixture({ timeoutSeconds: 120 })

    queueForUser(context, 'alice', [findings.nginx])
    const id = claimForWorker(context)?.checkId ?? 0

    for (let step = 0; step < 3; step += 1) {
      advance(60_000)
      expect(recordHeartbeat(context, id, 'investigating')).toBe('ok')
    }

    advance(1000)
    expect(recordHeartbeat(context, id, 'reporting')).toBe('not_running')
    expect(readChecks(context).recent[0]?.error).toMatch(/longer than 120 seconds/)
  })

  it('lets the next check start once the running one timed out', () => {
    const { context, findings, advance } = checkFixture()

    queueForUser(context, 'alice', [findings.nginx, findings.redis])
    claimForWorker(context)
    advance(121_000)

    expect(claimForWorker(context)?.findingId).toBe(findings.redis)
  })
})

describe('cancelForUser', () => {
  it('cancels a queued check, refuses an ended one and keeps queue positions dense', () => {
    const { context, findings } = checkFixture()
    const queued = queueForUser(context, 'alice', [findings.nginx, findings.redis]).queued

    expect(cancelForUser(context, 'alice', queued[0]?.id ?? 0)).toBe('cancelled')
    expect(cancelForUser(context, 'alice', queued[0]?.id ?? 0)).toBe('finished')
    expect(cancelForUser(context, 'alice', 9999)).toBe('not_found')

    const overview = readChecks(context)

    expect(overview.queued.map((check) => [check.id, check.position])).toEqual([[queued[1]?.id, 1]])
    expect(overview.recent[0]).toMatchObject({
      state: 'cancelled',
      startedAt: null,
      durationMs: null,
    })
  })
})
