// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { createPersonalTokenVerifier } from '#server/auth/personalTokenVerifier.ts'
import { checkFixture, NGINX } from '#server/checks/__tests__/checkFixtures.ts'
import { queueForUser } from '#server/checks/userCommands.ts'
import { claimForWorker } from '#server/checks/workerCommands.ts'
import { callerFromAuthInfo } from '#server/mcp/callerFromAuthInfo.ts'

const RESOURCE = new URL('https://sieb.example.com/mcp')

/**
 * Claims a check of nginx for alice and returns its token with a verifier over the fixture.
 * @returns {ReturnType<typeof checkFixture> & { secret: string; checkId: number; verify: ReturnType<typeof createPersonalTokenVerifier> }} - Fixture, token secret, check id and verifier
 */
const claimed = () => {
  const fixture = checkFixture()

  queueForUser(fixture.context, 'alice', [fixture.findings.nginx])

  const claim = claimForWorker(fixture.context)

  return {
    ...fixture,
    secret: claim?.token ?? '',
    checkId: claim?.checkId ?? 0,
    verify: createPersonalTokenVerifier({ db: fixture.db, clock: fixture.context.clock }),
  }
}

describe('check token verification', () => {
  it('carries the scope of its running check', async () => {
    const { secret, checkId, findings, verify } = claimed()
    const caller = callerFromAuthInfo(await verify(secret, RESOURCE))

    expect(caller).toMatchObject({
      actor: 'alice',
      via: 'token',
      scopes: ['sieb:read', 'sieb:propose'],
      check: { checkId, findingId: findings.nginx, vulnId: 'CVE-2025-1000', imageRef: NGINX },
    })
  })

  it('is refused once its check no longer runs, even before the token row is gone', async () => {
    const { db, secret, checkId, verify } = claimed()

    db.prepare(`UPDATE checks SET state = 'done', finished_at = 't' WHERE id = ?`).run(checkId)

    await expect(verify(secret, RESOURCE)).rejects.toThrow('Token revoked or expired')
  })

  it('refuses a malformed check scope in the auth info', () => {
    expect(() =>
      callerFromAuthInfo({
        token: 't',
        clientId: 'c',
        scopes: ['sieb:read'],
        extra: { actor: 'a', via: 'token', tokenId: 1, clientLabel: 'x', check: { checkId: 1 } },
      }),
    ).toThrow('malformed check scope')
  })
})
