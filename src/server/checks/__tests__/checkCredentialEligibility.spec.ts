// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { FindingDetailResponse } from '#core/findingApiTypes.ts'
import { checkFixture, PUBLIC_URL } from '#server/checks/__tests__/checkFixtures.ts'
import { claimForWorker } from '#server/checks/workerCommands.ts'
import { queueForUser } from '#server/checks/userCommands.ts'
import { storeCredential, testVault } from '#server/credentials/__tests__/credentialFixtures.ts'
import { deleteCredential } from '#server/credentials/credentialCommands.ts'
import { getCheck } from '#server/db/checkRepository.ts'
import { requestJson, testAppDeps } from '#server/http/__tests__/appFixtures.ts'
import { createApp } from '#server/http/createApp.ts'

const FETCHER = 'fetcher-secret-0123456789abcdefghijklmnop'

describe('Auto-check eligibility with stored credentials', () => {
  it('keeps own images ineligible without a credential, without the key or without the fetcher', () => {
    const vault = testVault()

    for (const settings of [{}, { vault }, { fetcherSecret: FETCHER }]) {
      const { context, findings, db } = checkFixture(settings)

      storeCredential(db, vault)

      expect(queueForUser(context, 'alice', [findings.own]).skipped).toEqual([
        { findingId: findings.own, reason: 'visibility_unknown' },
      ])
    }
  })

  it('queues and claims an own image covered by a registry credential, the owner self included', () => {
    const vault = testVault()
    const { context, findings, db } = checkFixture({ vault, fetcherSecret: FETCHER })

    storeCredential(db, vault)

    const result = queueForUser(context, 'alice', [findings.own, findings.other])

    expect(result.queued.map((check) => check.findingId)).toEqual([findings.own])
    expect(result.skipped).toEqual([{ findingId: findings.other, reason: 'not_public' }])
    expect(claimForWorker(context)?.imageRef).toMatch(/^registry\.example\.com\/acme\/shop:/)
  })

  it('fails a queued check at claim once its credential is gone', () => {
    const vault = testVault()
    const { context, findings, db } = checkFixture({ vault, fetcherSecret: FETCHER })
    const { id } = storeCredential(db, vault)
    const [queued] = queueForUser(context, 'alice', [findings.own]).queued

    deleteCredential(db, id)

    expect(claimForWorker(context)).toBeNull()
    expect(getCheck(db, queued?.id ?? 0)).toMatchObject({
      state: 'failed',
      error:
        'sieb could not tell whether the image can be pulled anonymously, and no registry credential covers it.',
    })
  })

  it('answers checkAccess in the finding detail', async () => {
    const vault = testVault()
    const fixture = checkFixture({ vault, fetcherSecret: FETCHER })
    const { id } = storeCredential(fixture.db, vault)
    const app = createApp(
      testAppDeps({
        db: fixture.db,
        mcpEnabled: true,
        publicUrl: PUBLIC_URL,
        checks: fixture.context,
      }),
    )
    const own = await requestJson<FindingDetailResponse>(
      app,
      `/api/findings/${fixture.findings.own}`,
    )
    const nginx = await requestJson<FindingDetailResponse>(
      app,
      `/api/findings/${fixture.findings.nginx}`,
    )
    const other = await requestJson<FindingDetailResponse>(
      app,
      `/api/findings/${fixture.findings.other}`,
    )

    expect(own.body).toMatchObject({ ownership: 'own', imageVisibility: 'credential' })
    expect(own.body.checkAccess).toEqual([
      {
        imageRef: 'registry.example.com/acme/shop',
        level: 'credential',
        credentialId: id,
        credentialLabel: 'Example GitLab',
      },
    ])
    expect(nginx.body.checkAccess).toMatchObject([{ level: 'public', credentialId: null }])
    expect(other.body.checkAccess).toMatchObject([{ level: 'none' }])
  })

  it('answers no credential access while checks are off', async () => {
    const vault = testVault()
    const fixture = checkFixture()

    storeCredential(fixture.db, vault)

    const app = createApp(
      testAppDeps({ db: fixture.db, credentials: { vault, fetch: globalThis.fetch } }),
    )
    const own = await requestJson<FindingDetailResponse>(
      app,
      `/api/findings/${fixture.findings.own}`,
    )

    expect(own.body.checkAccess).toMatchObject([{ level: 'none', credentialId: null }])
  })
})
