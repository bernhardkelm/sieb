// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { MAX_LIVE_TOKENS } from '#core/apiToken.ts'
import type { ApiTokenView, McpInfoResponse } from '#core/apiTypes.ts'
import { checkFixture, PUBLIC_URL } from '#server/checks/__tests__/checkFixtures.ts'
import { cancelForUser, queueForUser } from '#server/checks/userCommands.ts'
import { claimForWorker } from '#server/checks/workerCommands.ts'
import { hashTokenSecret } from '#server/auth/tokenSecrets.ts'
import { findTokenByHash } from '#server/db/apiTokenRepository.ts'
import { getCheck } from '#server/db/checkRepository.ts'
import { insertToken } from '#server/db/storeApiToken.ts'
import { requestJson, testAppDeps } from '#server/http/__tests__/appFixtures.ts'
import { createApp } from '#server/http/createApp.ts'

const ALICE = { 'X-authentik-username': 'alice' }
const EXPIRY = '2026-12-01T00:00:00.000Z'

/**
 * Creates the main app over a check fixture whose check of nginx alice queued and the worker
 * claimed.
 * @returns {ReturnType<typeof checkFixture> & { app: ReturnType<typeof createApp>; tokenId: number; secret: string }} - Fixture, app and the check token
 */
const runningCheck = () => {
  const fixture = checkFixture()

  queueForUser(fixture.context, 'alice', [fixture.findings.nginx])

  const claim = claimForWorker(fixture.context)
  const tokenId = getCheck(fixture.db, claim?.checkId ?? 0)?.tokenId ?? 0
  const app = createApp(
    testAppDeps({
      db: fixture.db,
      devUser: null,
      mcpEnabled: true,
      publicUrl: PUBLIC_URL,
      checks: fixture.context,
    }),
  )

  return { ...fixture, app, tokenId, secret: claim?.token ?? '', checkId: claim?.checkId ?? 0 }
}

/**
 * Stores a personal read token of alice.
 * @param {ReturnType<typeof checkFixture>['db']} db - Database
 * @param {number} index - Distinguishes names and hashes
 * @returns {ReturnType<typeof insertToken>} - Result
 */
const userToken = (db: ReturnType<typeof checkFixture>['db'], index: number) =>
  insertToken(
    db,
    {
      owner: 'alice',
      input: { name: `laptop ${index}`, scope: 'read', expiresAt: EXPIRY },
      prefix: 'sieb_prefix',
      hash: hashTokenSecret(`alice-${index}`),
    },
    new Date('2026-06-01T11:00:00.000Z'),
  )

describe('check tokens in the token API', () => {
  it('leaves the running check token out of the list', async () => {
    const { app } = runningCheck()
    const list = await requestJson<ApiTokenView[]>(app, '/api/tokens', 'GET', undefined, ALICE)

    expect(list.status).toBe(200)
    expect(list.body).toEqual([])
  })

  it('refuses to revoke or delete it, cancelling the check is the way', async () => {
    const { app, db, tokenId, secret } = runningCheck()

    expect(
      (await requestJson(app, `/api/tokens/${tokenId}/revoke`, 'POST', {}, ALICE)).status,
    ).toBe(404)
    expect(
      (await requestJson(app, `/api/tokens/${tokenId}`, 'DELETE', undefined, ALICE)).status,
    ).toBe(404)
    expect((await requestJson(app, '/api/tokens/cleanup', 'POST', {}, ALICE)).body).toEqual({
      deleted: 0,
    })
    expect(findTokenByHash(db, hashTokenSecret(secret))?.revokedAt).toBeNull()
  })

  it('does not count it against the live-token cap', () => {
    const { db } = runningCheck()

    for (let index = 0; index < MAX_LIVE_TOKENS; index += 1) {
      expect(userToken(db, index).ok).toBe(true)
    }

    expect(userToken(db, MAX_LIVE_TOKENS)).toEqual({ ok: false, error: 'too_many_tokens' })
  })
})

describe('check tokens and the Claude connection', () => {
  it('do not make the requester count as connected', async () => {
    const { app } = runningCheck()
    const info = await requestJson<McpInfoResponse>(app, '/api/mcp-info', 'GET', undefined, ALICE)

    expect(info.body.claude).toEqual({ connected: false, activeTokens: 0, oauthLastSeenAt: null })
  })
})

describe('token ids after a check', () => {
  it('hands out an id above the token_id of a check whose token row is gone', () => {
    const { db, context, tokenId, checkId } = runningCheck()

    expect(cancelForUser(context, 'alice', checkId)).toBe('cancelled')
    expect(db.prepare('SELECT COUNT(*) AS n FROM api_tokens').get()?.n).toBe(0)

    const next = userToken(db, 1)

    expect(next.ok && next.token.id).toBe(tokenId + 1)
  })
})
