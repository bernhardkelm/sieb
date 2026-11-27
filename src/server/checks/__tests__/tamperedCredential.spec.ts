// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { FindingDetailResponse } from '#core/findingApiTypes.ts'
import { checkFixture, PUBLIC_URL } from '#server/checks/__tests__/checkFixtures.ts'
import { fetchAccessFor } from '#server/checks/fetchAccess.ts'
import { queueForUser } from '#server/checks/userCommands.ts'
import { claimForWorker } from '#server/checks/workerCommands.ts'
import {
  GITLAB_INPUT,
  storeCredential,
  testVault,
} from '#server/credentials/__tests__/credentialFixtures.ts'
import { listUsableScopes } from '#server/db/credentialRepository.ts'
import { requestJson, testAppDeps } from '#server/http/__tests__/appFixtures.ts'
import { createApp } from '#server/http/createApp.ts'

const FETCHER = 'fetcher-secret-0123456789abcdefghijklmnop'

const SHOP_ONLY = {
  ...GITLAB_INPUT,
  label: 'Shop only',
  uses: ['registry'],
  gitHost: null,
  pathPrefix: 'acme/tools',
  repoMapping: null,
}

/**
 * Opens a check fixture with private access on and the app over it.
 * @returns {ReturnType<typeof checkFixture> & { vault: ReturnType<typeof testVault>; app: ReturnType<typeof createApp> }} - Fixture, vault and app
 */
const privateFixture = () => {
  const vault = testVault()
  const fixture = checkFixture({ vault, fetcherSecret: FETCHER })
  const app = createApp(
    testAppDeps({
      db: fixture.db,
      mcpEnabled: true,
      publicUrl: PUBLIC_URL,
      checks: fixture.context,
    }),
  )

  return { ...fixture, vault, app }
}

describe('credentials changed outside sieb', () => {
  it('cover no image when the ciphertext was changed', async () => {
    const { db, vault, app, context, findings } = privateFixture()
    const { id, secret_ciphertext } = storeCredential(db, vault)
    const flipped = Buffer.from(secret_ciphertext)

    flipped[flipped.length - 1] ^= 1
    db.prepare('UPDATE access_credentials SET secret_ciphertext = ? WHERE id = ?').run(flipped, id)

    const own = await requestJson<FindingDetailResponse>(app, `/api/findings/${findings.own}`)

    expect(listUsableScopes(db, vault)).toEqual([])
    expect(own.body.checkAccess).toMatchObject([{ level: 'none', credentialId: null }])
    expect(queueForUser(context, 'alice', [findings.own]).skipped).toEqual([
      { findingId: findings.own, reason: 'not_public' },
    ])
  })

  it('do not shadow a valid credential when a bound field was widened', async () => {
    const { db, vault, app, context, findings, logs } = privateFixture()
    const valid = storeCredential(db, vault)
    const tampered = storeCredential(db, vault, SHOP_ONLY)

    db.prepare(`UPDATE access_credentials SET path_prefix = 'acme/shop' WHERE id = ?`).run(
      tampered.id,
    )

    const own = await requestJson<FindingDetailResponse>(app, `/api/findings/${findings.own}`)

    expect(listUsableScopes(db, vault).map((scope) => scope.id)).toEqual([valid.id])
    expect(own.body.checkAccess).toMatchObject([{ level: 'credential', credentialId: valid.id }])
    expect(queueForUser(context, 'alice', [findings.own]).queued).toHaveLength(1)

    const claim = claimForWorker(context)
    const access = fetchAccessFor(context, claim?.checkId ?? 0)

    expect(access).toMatchObject({
      ok: true,
      value: { registries: [{ host: 'registry.example.com' }] },
    })
    expect(logs).toContain(
      `[sieb] check ${claim?.checkId}: credential ${valid.id} handed to the fetcher for registry registry.example.com`,
    )
  })
})
