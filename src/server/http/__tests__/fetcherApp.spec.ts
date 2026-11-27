// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { CheckView, ChecksResponse, WorkerClaim } from '#core/check.ts'
import type { FetchAccess, SourceAnswer } from '#core/privateAccess.ts'
import { checkFixture, PUBLIC_URL } from '#server/checks/__tests__/checkFixtures.ts'
import { queueForUser } from '#server/checks/userCommands.ts'
import {
  GITLAB_INPUT,
  GITLAB_SECRET,
  storeCredential,
  testVault,
} from '#server/credentials/__tests__/credentialFixtures.ts'
import { getCredentialRow } from '#server/db/credentialRepository.ts'
import { requestJson, testAppDeps } from '#server/http/__tests__/appFixtures.ts'
import { createApp } from '#server/http/createApp.ts'
import { createWorkerApp } from '#server/http/workerApp.ts'

const WORKER = 'worker-secret-0123456789abcdefghijklmnop'
const FETCHER = 'fetcher-secret-0123456789abcdefghijklmnop'
const OWN = 'registry.example.com/acme/shop'
const COMMIT = 'abcdef0123456789abcdef0123456789abcdef01'

/**
 * Creates the worker app with both secrets over a fixture with the GitLab test credential.
 * @param {{ fetcherSecret?: string | null; mapping?: boolean }} options - Fetcher secret and whether the credential maps registry paths to repositories
 * @returns {ReturnType<typeof checkFixture> & { worker: ReturnType<typeof createWorkerApp>; credentialId: number }} - Fixture, worker app and credential id
 */
const setup = ({
  fetcherSecret = FETCHER,
  mapping = true,
}: { fetcherSecret?: string | null; mapping?: boolean } = {}) => {
  const vault = testVault()
  const fixture = checkFixture({ vault, fetcherSecret })
  const { id } = storeCredential(fixture.db, vault, {
    ...GITLAB_INPUT,
    repoMapping: mapping ? GITLAB_INPUT.repoMapping : null,
  })
  const worker = createWorkerApp({
    context: fixture.context,
    secret: WORKER,
    fetcherSecret,
    log: () => {},
  })

  return { ...fixture, worker, credentialId: id }
}

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
 * Queues and claims the check of a finding through the worker routes.
 * @param {ReturnType<typeof setup>} fixture - Fixture
 * @param {number} findingId - Finding to check
 * @returns {Promise<WorkerClaim>} - Claim
 */
const claimOf = async (
  fixture: ReturnType<typeof setup>,
  findingId: number,
): Promise<WorkerClaim> => {
  queueForUser(fixture.context, 'alice', [findingId])
  return (await (await post(fixture.worker, '/worker/claim', WORKER)).json()) as WorkerClaim
}

/**
 * Asks for the source of a check's image.
 * @param {ReturnType<typeof setup>} fixture - Fixture
 * @param {number} checkId - Check id
 * @param {Record<string, unknown>} body - Request overrides
 * @returns {Promise<{ status: number; body: SourceAnswer }>} - Answer
 */
const source = async (
  fixture: ReturnType<typeof setup>,
  checkId: number,
  body: Record<string, unknown> = {},
) => {
  const response = await post(fixture.worker, `/worker/checks/${checkId}/source`, FETCHER, {
    imageRef: OWN,
    sourceLabel: null,
    revisionLabel: null,
    ...body,
  })

  return { status: response.status, body: (await response.json()) as SourceAnswer }
}

describe('fetcher auth', () => {
  it('answers 404 without SIEB_FETCHER_SECRET, whatever secret is sent', async () => {
    const fixture = setup({ fetcherSecret: null })

    for (const secret of [WORKER, FETCHER]) {
      expect((await post(fixture.worker, '/worker/checks/1/access', secret)).status).toBe(404)
      expect(
        (await post(fixture.worker, '/worker/checks/1/source', secret, { imageRef: OWN })).status,
      ).toBe(404)
    }
  })

  it('takes only the fetcher secret on the fetcher routes and refuses it everywhere else', async () => {
    const fixture = setup()

    for (const secret of [WORKER, `${FETCHER}x`, '']) {
      expect((await post(fixture.worker, '/worker/checks/1/access', secret)).status).toBe(401)
      expect((await post(fixture.worker, '/worker/checks/1/source/', secret)).status).toBe(401)
    }

    expect((await post(fixture.worker, '/worker/claim', FETCHER)).status).toBe(401)
    expect(
      (await post(fixture.worker, '/worker/checks/1/heartbeat', FETCHER, { phase: 'preparing' }))
        .status,
    ).toBe(401)
    expect(fixture.context.presence.online(fixture.context.clock())).toBe(false)
  })
})

describe('POST /worker/checks/:id/access', () => {
  it('hands out the registry login of the running check image only and records its use', async () => {
    const fixture = setup()
    const claim = await claimOf(fixture, fixture.findings.own)
    const response = await post(fixture.worker, `/worker/checks/${claim.checkId}/access`, FETCHER)

    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual<FetchAccess>({
      registries: [
        {
          host: 'registry.example.com',
          label: 'Example GitLab',
          username: 'deploy-bot',
          secret: GITLAB_SECRET,
        },
      ],
      images: claim.images ?? [],
    })
    expect(getCredentialRow(fixture.db, fixture.credentialId)?.last_used_at).not.toBeNull()
    expect(fixture.logs.join('\n')).not.toContain(GITLAB_SECRET)
    expect(fixture.logs).toContainEqual(
      expect.stringContaining('handed to the fetcher for registry registry.example.com'),
    )
  })

  it('answers no login for an image no credential covers', async () => {
    const fixture = setup()
    const claim = await claimOf(fixture, fixture.findings.nginx)
    const response = await post(fixture.worker, `/worker/checks/${claim.checkId}/access`, FETCHER)

    expect(await response.json()).toEqual({ registries: [], images: claim.images })
  })

  it('names the images of the claim, so the fetcher pulls nothing the checker picks', async () => {
    const fixture = setup()
    const claim = await claimOf(fixture, fixture.findings.nginx)
    const body = (await (
      await post(fixture.worker, `/worker/checks/${claim.checkId}/access`, FETCHER)
    ).json()) as FetchAccess

    expect(claim.images?.length).toBeGreaterThan(0)
    expect(body.images).toEqual(claim.images)
    expect(body.images[0]?.imageRef).toBe(claim.imageRef)
  })

  it('answers 409 not_pullable once the finding has no pullable image left', async () => {
    const fixture = setup()
    const claim = await claimOf(fixture, fixture.findings.own)

    fixture.db
      .prepare(
        'UPDATE finding_instances SET image_tag = NULL, image_digest = NULL WHERE finding_id = ?',
      )
      .run(fixture.findings.own)

    const response = await post(fixture.worker, `/worker/checks/${claim.checkId}/access`, FETCHER)

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'not_pullable' })
    expect(getCredentialRow(fixture.db, fixture.credentialId)?.last_used_at).toBeNull()
  })

  it('answers 409 once the check is not running and 404 for an unknown one', async () => {
    const fixture = setup()
    const [queued] = queueForUser(fixture.context, 'alice', [fixture.findings.own]).queued

    expect(
      (await post(fixture.worker, `/worker/checks/${queued?.id}/access`, FETCHER)).status,
    ).toBe(409)
    expect((await post(fixture.worker, '/worker/checks/999/access', FETCHER)).status).toBe(404)
    expect((await post(fixture.worker, '/worker/checks/abc/access', FETCHER)).status).toBe(404)
  })
})

describe('POST /worker/checks/:id/source', () => {
  it('grants the clone of the repository the source label names, with its commit', async () => {
    const fixture = setup()
    const { checkId } = await claimOf(fixture, fixture.findings.own)
    const answer = await source(fixture, checkId, {
      sourceLabel: 'https://gitlab.example.com/acme/shop',
      revisionLabel: COMMIT.toUpperCase(),
    })

    expect(answer).toEqual({
      status: 200,
      body: {
        grant: {
          repoUrl: 'https://gitlab.example.com/acme/shop.git',
          revision: COMMIT,
          username: 'deploy-bot',
          secret: GITLAB_SECRET,
        },
      },
    })
  })

  it('resolves by the mapping without a label, or when the label is not https or not covered', async () => {
    const fixture = setup()
    const { checkId } = await claimOf(fixture, fixture.findings.own)
    const mapped = { repoUrl: 'https://gitlab.example.com/acme/shop.git' }

    expect((await source(fixture, checkId, { revisionLabel: COMMIT })).body).toMatchObject({
      grant: { ...mapped, revision: COMMIT },
    })
    expect(
      (
        await source(fixture, checkId, {
          sourceLabel: 'http://gitlab.example.com/acme/shop',
          revisionLabel: COMMIT,
        })
      ).body,
    ).toMatchObject({
      grant: { ...mapped, revision: null },
    })
    expect(
      (await source(fixture, checkId, { sourceLabel: 'https://github.com/nodejs/docker-node' }))
        .body,
    ).toMatchObject({
      grant: mapped,
    })
  })

  it('skips without a mapping for a missing, non-https or foreign repository', async () => {
    const fixture = setup({ mapping: false })
    const { checkId } = await claimOf(fixture, fixture.findings.own)

    expect((await source(fixture, checkId)).body).toEqual({ skip: 'no_repository' })
    expect(
      (await source(fixture, checkId, { sourceLabel: 'git@gitlab.example.com:acme/shop.git' }))
        .body,
    ).toEqual({
      skip: 'not_https',
    })
    expect(
      (await source(fixture, checkId, { sourceLabel: 'https://evil.example.org/acme/shop' })).body,
    ).toEqual({
      skip: 'no_credential',
    })
    expect(
      (await source(fixture, checkId, { sourceLabel: 'https://gitlab.example.com/other/shop' }))
        .body,
    ).toEqual({
      skip: 'foreign_repository',
    })
  })

  it('drops a revision that is not a commit and refuses an image the check did not claim', async () => {
    const fixture = setup()
    const { checkId } = await claimOf(fixture, fixture.findings.own)

    for (const revisionLabel of ['main', 'abc12', `${COMMIT}${COMMIT}`, '--upload-pack=x']) {
      expect((await source(fixture, checkId, { revisionLabel })).body).toMatchObject({
        grant: { revision: null },
      })
    }

    expect(
      await source(fixture, checkId, { imageRef: 'registry.example.com/acme/other' }),
    ).toMatchObject({
      status: 400,
      body: { errors: [{ field: 'imageRef', code: 'not_claimed' }] },
    })
    expect((await source(fixture, checkId, { imageRef: `${OWN}:1.27.0` })).status).toBe(200)
  })
})

describe('result with source', () => {
  it('stores the checked out repository and answers it in the check view', async () => {
    const fixture = setup()
    const main = createApp(
      testAppDeps({
        db: fixture.db,
        mcpEnabled: true,
        publicUrl: PUBLIC_URL,
        checks: fixture.context,
      }),
    )
    const { checkId } = await claimOf(fixture, fixture.findings.own)
    const result = { status: 'done', error: null, durationMs: 1, usage: null, reply: 'Done.' }
    const path = `/worker/checks/${checkId}/result`

    expect(
      (
        await post(fixture.worker, path, WORKER, {
          ...result,
          source: { repoUrl: 'http://x.example.com/a/b', revision: null, fromLabel: true },
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await post(fixture.worker, path, WORKER, {
          ...result,
          source: {
            repoUrl: 'https://gitlab.example.com/acme/shop.git',
            revision: COMMIT,
            fromLabel: false,
          },
        })
      ).status,
    ).toBe(204)

    const checks = await requestJson<ChecksResponse>(main, '/api/checks')
    const [checked] = checks.body.recent as CheckView[]

    expect(checked?.source).toEqual({
      repoUrl: 'https://gitlab.example.com/acme/shop.git',
      revision: COMMIT,
      fromLabel: false,
    })
  })

  it('answers source null for a check without one', async () => {
    const fixture = setup()
    const main = createApp(
      testAppDeps({
        db: fixture.db,
        mcpEnabled: true,
        publicUrl: PUBLIC_URL,
        checks: fixture.context,
      }),
    )
    const { checkId } = await claimOf(fixture, fixture.findings.nginx)

    await post(fixture.worker, `/worker/checks/${checkId}/result`, WORKER, {
      status: 'done',
      error: null,
      durationMs: 1,
      usage: null,
      reply: null,
    })

    expect(
      (await requestJson<ChecksResponse>(main, '/api/checks')).body.recent[0]?.source,
    ).toBeNull()
  })
})
