// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { WorkerClaim } from '#core/check.ts'
import type { SourceAnswer } from '#core/privateAccess.ts'
import { checkFixture, START } from '#server/checks/__tests__/checkFixtures.ts'
import { queueForUser } from '#server/checks/userCommands.ts'
import {
  GITLAB_INPUT,
  storeCredential,
  testVault,
} from '#server/credentials/__tests__/credentialFixtures.ts'
import { createWorkerApp } from '#server/http/workerApp.ts'
import { storePullProbe } from '#server/visibility/pullProbeRepository.ts'

const WORKER = 'worker-secret-0123456789abcdefghijklmnop'
const FETCHER = 'fetcher-secret-0123456789abcdefghijklmnop'
const COMMIT = 'abcdef0123456789abcdef0123456789abcdef01'

/**
 * Posts a JSON body with a bearer secret.
 * @param {ReturnType<typeof createWorkerApp>} app - Worker app
 * @param {string} path - Path
 * @param {string} secret - Bearer secret
 * @param {unknown} body - JSON body
 * @returns {Promise<Response>} - Response
 */
const post = (
  app: ReturnType<typeof createWorkerApp>,
  path: string,
  secret: string,
  body: unknown = {},
) =>
  app.request(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

/**
 * Claims a check of the fixture's own finding moved to another image ref and owner, pullable
 * anonymously by a stored probe, optionally with the registry-only test credential.
 * @param {{ imageRef: string; owner?: string; credential?: boolean }} options - Image, owner label and whether a registry-only credential with repoMapping is stored
 * @returns {Promise<{ worker: ReturnType<typeof createWorkerApp>; checkId: number; imageRef: string }>} - Worker app, check id and image
 */
const claimed = async ({
  imageRef,
  owner = 'self',
  credential = false,
}: {
  imageRef: string
  owner?: string
  credential?: boolean
}) => {
  const vault = credential ? testVault() : null
  const fixture = checkFixture({ fetcherSecret: FETCHER, vault })

  fixture.db
    .prepare('UPDATE findings SET image_ref = ?, owner = ? WHERE id = ?')
    .run(imageRef, owner, fixture.findings.own)
  storePullProbe(fixture.db, imageRef, { result: 'public', reason: null }, START)

  if (vault !== null) {
    storeCredential(fixture.db, vault, { ...GITLAB_INPUT, uses: ['registry'] })
  }

  const worker = createWorkerApp({
    context: fixture.context,
    secret: WORKER,
    fetcherSecret: FETCHER,
    log: () => {},
  })

  queueForUser(fixture.context, 'alice', [fixture.findings.own])

  const claim = (await (await post(worker, '/worker/claim', WORKER)).json()) as WorkerClaim

  return { worker, checkId: claim.checkId, imageRef }
}

/**
 * Asks for the source of a claimed check.
 * @param {Awaited<ReturnType<typeof claimed>>} check - Claimed check
 * @param {string | null} sourceLabel - Source label of the image
 * @param {string | null} revisionLabel - Revision label of the image
 * @returns {Promise<SourceAnswer>} - Answer
 */
const sourceOf = async (
  { worker, checkId, imageRef }: Awaited<ReturnType<typeof claimed>>,
  sourceLabel: string | null = null,
  revisionLabel: string | null = null,
): Promise<SourceAnswer> =>
  (await (
    await post(worker, `/worker/checks/${checkId}/source`, FETCHER, {
      imageRef,
      sourceLabel,
      revisionLabel,
    })
  ).json()) as SourceAnswer

/**
 * Builds an anonymous grant.
 * @param {string[]} repoUrls - Repository URLs in order
 * @param {string | null} revision - Commit
 * @returns {SourceAnswer} - Grant without login
 */
const anonymous = (repoUrls: string[], revision: string | null = null): SourceAnswer => ({
  grant: { repoUrls, revision, username: null, secret: null },
})

describe('anonymous source grants without a git credential', () => {
  it('grants the own-owner label of an own image without a login, with its commit', async () => {
    const check = await claimed({ imageRef: 'registry.example.com/acme/shop' })

    expect(await sourceOf(check, 'https://github.com/acme/shop', COMMIT)).toEqual(
      anonymous(['https://github.com/acme/shop.git'], COMMIT),
    )
  })

  it('maps an own ghcr.io image to its GitHub repository by default', async () => {
    const check = await claimed({ imageRef: 'ghcr.io/acme/shop' })

    expect(await sourceOf(check)).toEqual(anonymous(['https://github.com/acme/shop.git']))
  })

  it('tries the GitLab project paths of a nested own image, longest first', async () => {
    const check = await claimed({ imageRef: 'registry.gitlab.com/acme/shop/api' })

    expect(await sourceOf(check)).toEqual(
      anonymous(['https://gitlab.com/acme/shop/api.git', 'https://gitlab.com/acme/shop.git']),
    )
  })

  it('keeps at most three GitLab candidates', async () => {
    const check = await claimed({ imageRef: 'registry.gitlab.com/acme/a/b/c/d' })
    const answer = await sourceOf(check)

    expect('grant' in answer && answer.grant.repoUrls).toEqual([
      'https://gitlab.com/acme/a/b/c/d.git',
      'https://gitlab.com/acme/a/b/c.git',
      'https://gitlab.com/acme/a/b.git',
    ])
  })

  it('skips a missing, non-https or foreign repository of an own image elsewhere', async () => {
    const check = await claimed({ imageRef: 'registry.example.com/acme/shop' })

    expect(await sourceOf(check)).toEqual({ skip: 'no_repository' })
    expect(await sourceOf(check, 'git@github.com:acme/shop.git')).toEqual({ skip: 'not_https' })
    expect(await sourceOf(check, 'https://github.com/other/base')).toEqual({
      skip: 'foreign_repository',
    })
  })

  it('maps no repository for a third-party image without label', async () => {
    const check = await claimed({ imageRef: 'ghcr.io/acme/tool', owner: 'platform' })

    expect(await sourceOf(check)).toEqual({ skip: 'no_repository' })
  })

  it('still needs a git credential for an explicit repoMapping', async () => {
    const check = await claimed({ imageRef: 'registry.example.com/acme/shop', credential: true })

    expect(await sourceOf(check)).toEqual({ skip: 'no_credential' })
  })
})

describe('worker result source validation', () => {
  it('takes refKind and ref and refuses a ref that does not fit its kind', async () => {
    const check = await claimed({ imageRef: 'ghcr.io/acme/shop' })
    const path = `/worker/checks/${check.checkId}/result`
    const result = { status: 'done', error: null, durationMs: 1, usage: null, reply: 'Done.' }
    const base = { repoUrl: 'https://github.com/acme/shop.git', revision: COMMIT, fromLabel: false }
    const status = async (source: Record<string, unknown>): Promise<number> =>
      (await post(check.worker, path, WORKER, { ...result, source })).status

    expect(await status({ ...base, refKind: 'tag', ref: '-upload-pack' })).toBe(400)
    expect(await status({ ...base, refKind: 'tag', ref: null })).toBe(400)
    expect(await status({ ...base, refKind: 'label', ref: 'v1.2.3' })).toBe(400)
    expect(await status({ ...base, refKind: 'branch', ref: null })).toBe(400)
    expect(await status(base)).toBe(400)
    expect(await status({ ...base, refKind: 'tag', ref: 'v1.2.3' })).toBe(204)
  })
})
