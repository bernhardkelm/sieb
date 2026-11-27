// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { AccessTestRefusal } from '#core/accessTestVerdict.ts'
import type { AccessTestResult } from '#core/privateAccess.ts'
import {
  GITLAB_INPUT,
  GITLAB_SECRET,
  storeCredential,
} from '#server/credentials/__tests__/credentialFixtures.ts'
import { openCredential } from '#server/credentials/credentialSecrets.ts'
import type { CredentialVault } from '#server/credentials/credentialVault.ts'
import { ProbeRefused } from '#server/credentials/probe/probeHttps.ts'
import { countCredentials, getCredentialRow } from '#server/db/credentialRepository.ts'
import {
  credentialApp,
  reachableFetch,
  send,
} from '#server/http/routes/__tests__/credentialRouteFixtures.ts'

/** A fetch double that records the URLs and Authorization headers it was sent */
interface RecordingFetch {
  fetch: typeof globalThis.fetch
  calls: { url: string; auth: string | undefined }[]
}

/**
 * Creates a fetch that answers a status for URLs containing a key, else like reachableFetch.
 * @param {Record<string, number | 'refused'>} answers - Status, or refused for a private address, by URL part
 * @returns {RecordingFetch} - Fetch and its calls
 */
const answering = (answers: Record<string, number | 'refused'> = {}): RecordingFetch => {
  const calls: RecordingFetch['calls'] = []
  const fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input)
    const answer = Object.entries(answers).find(([part]) => url.includes(part))?.[1]

    calls.push({ url, auth: (init.headers as Record<string, string>).Authorization })

    if (answer === 'refused') {
      throw new ProbeRefused('address not allowed')
    }

    return answer === undefined
      ? reachableFetch(input, init)
      : new Response(null, { status: answer })
  }) as typeof globalThis.fetch

  return { fetch, calls }
}

/**
 * Returns the basic auth header of the GitLab fixture login with a secret.
 * @param {string} secret - Secret
 * @returns {string} - Header value
 */
const basicOf = (secret: string): string =>
  `Basic ${Buffer.from(`deploy-bot:${secret}`).toString('base64')}`

describe('test before storing a credential', () => {
  it.each([
    ['a refused login on one image', { '/acme/lib/': 401 }, 'test_failed'],
    ['every image missing', { '/manifests/': 404 }, 'test_failed'],
    ['a forbidden repository', { 'lib.git': 403 }, 'test_failed'],
    ['only hosts on private addresses', { 'example.com': 'refused' as const }, 'untestable'],
  ])('refuses a new credential on %s and stores and logs nothing', async (_, answers, error) => {
    const { fetch } = answering(answers)
    const { app, deps, logs } = credentialApp({ fetch })
    const refused = await send<AccessTestRefusal>(app, '/api/credentials', 'POST', GITLAB_INPUT)

    expect(refused).toMatchObject({
      status: 422,
      body: { error, result: { at: expect.any(String) } },
    })
    expect(refused.text).not.toContain(GITLAB_SECRET)
    expect(refused.text).not.toContain('deploy-bot')
    expect(countCredentials(deps.db)).toBe(0)
    expect(logs).toEqual([])
  })

  it('stores a credential whose images partly moved on while one per use is reachable', async () => {
    const { fetch } = answering({ '/acme/lib/': 404, 'lib.git': 404 })
    const { app } = credentialApp({ fetch })
    const created = await send(app, '/api/credentials', 'POST', GITLAB_INPUT)

    expect(created).toMatchObject({
      status: 201,
      body: { lastTest: { registry: { checked: 2, ok: 1 }, git: { checked: 2, ok: 1 } } },
    })
  })

  it('refuses a prefix that covers nothing sieb has seen', async () => {
    const { fetch, calls } = answering()
    const { app, deps } = credentialApp({ fetch })
    const refused = await send<AccessTestRefusal>(app, '/api/credentials', 'POST', {
      ...GITLAB_INPUT,
      pathPrefix: 'nobody',
      repoMapping: null,
    })

    expect(refused).toMatchObject({
      status: 422,
      body: { error: 'nothing_to_test', result: { registry: { checked: 0 }, git: { checked: 0 } } },
    })
    expect(calls).toEqual([])
    expect(countCredentials(deps.db)).toBe(0)
  })

  it('stores an untestable credential only with confirmUntested and records it', async () => {
    const { fetch } = answering({ 'example.com': 'refused' })
    const { app } = credentialApp({ fetch })
    const body = { ...GITLAB_INPUT, confirmUntested: true }

    expect(
      await send(app, '/api/credentials', 'POST', { ...body, confirmUntested: 'yes' }),
    ).toMatchObject({
      status: 400,
      body: { errors: [{ field: 'confirmUntested', code: 'invalid' }] },
    })
    expect(await send(app, '/api/credentials', 'POST', body)).toMatchObject({
      status: 201,
      body: { lastTest: { untested: true, registry: { ok: 0, blocked: 2 } } },
    })
  })

  it('does not let confirmUntested pass a refused login', async () => {
    const { fetch } = answering({ '/acme/lib/': 'refused', '/acme/shop/': 401 })
    const { app, deps } = credentialApp({ fetch })

    expect(
      await send(app, '/api/credentials', 'POST', { ...GITLAB_INPUT, confirmUntested: true }),
    ).toMatchObject({ status: 422, body: { error: 'test_failed' } })
    expect(countCredentials(deps.db)).toBe(0)
  })

  it('re-tests a change of the prefix or token, not of the label alone', async () => {
    const { fetch, calls } = answering()
    const { app, deps, vault, logs } = credentialApp({ fetch })
    const { id } = storeCredential(deps.db, vault as CredentialVault)
    const renamed = await send(app, `/api/credentials/${id}`, 'PATCH', { label: 'Renamed' })

    expect(renamed).toMatchObject({ status: 200, body: { label: 'Renamed', lastTest: null } })
    expect(calls).toEqual([])

    const moved = await send(app, `/api/credentials/${id}`, 'PATCH', {
      pathPrefix: 'acme/shop',
      repoMapping: null,
      uses: ['registry'],
    })

    expect(moved).toMatchObject({ status: 200, body: { lastTest: { registry: { checked: 1 } } } })
    expect(calls.every((call) => [undefined, basicOf(GITLAB_SECRET)].includes(call.auth))).toBe(
      true,
    )
    expect(
      (await send(app, `/api/credentials/${id}`, 'PATCH', { label: 'Again' })).body.lastTest,
    ).toEqual(moved.body.lastTest)

    const before = getCredentialRow(deps.db, id)
    const refused = await send(app, `/api/credentials/${id}`, 'PATCH', { pathPrefix: 'nobody' })

    expect(refused).toMatchObject({ status: 422, body: { error: 'nothing_to_test' } })
    expect(getCredentialRow(deps.db, id)).toEqual(before)
    expect(logs.filter((line) => line.includes('updated'))).toHaveLength(3)
  })

  it('keeps the stored token when a new one fails its test', async () => {
    const { fetch } = answering({ '/manifests/': 401 })
    const { app, deps, vault } = credentialApp({ fetch })
    const { id } = storeCredential(deps.db, vault as CredentialVault)
    const refused = await send(app, `/api/credentials/${id}`, 'PATCH', { secret: 'glpat-wrong' })

    expect(refused).toMatchObject({ status: 422, body: { error: 'test_failed' } })
    expect(refused.text).not.toContain('glpat-wrong')
    expect(openCredential(vault as CredentialVault, getCredentialRow(deps.db, id)!)?.secret).toBe(
      GITLAB_SECRET,
    )
  })
})

describe('POST /api/credentials/test', () => {
  it('tests entered values and stores and logs nothing', async () => {
    const { fetch } = answering({ '/acme/lib/': 401 })
    const { app, deps, logs } = credentialApp({ fetch })
    const tested = await send<AccessTestResult>(app, '/api/credentials/test', 'POST', GITLAB_INPUT)

    expect(tested).toMatchObject({
      status: 200,
      body: { registry: { checked: 2, ok: 1, denied: 1 }, git: { checked: 2, ok: 2 } },
    })
    expect(tested.text).not.toContain(GITLAB_SECRET)
    expect(countCredentials(deps.db)).toBe(0)
    expect(logs).toEqual([])
  })

  it('tests the changes of a stored credential with its stored token or a new one', async () => {
    const { fetch, calls } = answering()
    const { app, deps, vault } = credentialApp({ fetch })
    const { id } = storeCredential(deps.db, vault as CredentialVault)
    const before = getCredentialRow(deps.db, id)

    expect(await send(app, '/api/credentials/test', 'POST', { id })).toMatchObject({
      status: 200,
      body: { registry: { checked: 2, ok: 2 }, git: { checked: 2, ok: 2 } },
    })
    expect(calls.at(-1)?.auth).toBe(basicOf(GITLAB_SECRET))

    await send(app, '/api/credentials/test', 'POST', { id, secret: 'glpat-candidate' })

    expect(calls.at(-1)?.auth).toBe(basicOf('glpat-candidate'))
    expect(getCredentialRow(deps.db, id)).toEqual(before)
  })

  it('never sends the stored token to a new host and answers unknown ids', async () => {
    const { fetch, calls } = answering()
    const { app, deps, vault } = credentialApp({ fetch })
    const { id } = storeCredential(deps.db, vault as CredentialVault)

    expect(
      await send(app, '/api/credentials/test', 'POST', {
        id,
        registryHost: 'registry.other.example',
        repoMapping: null,
      }),
    ).toMatchObject({ status: 409, body: { error: 'secret_required' } })
    expect(calls).toEqual([])
    expect((await send(app, '/api/credentials/test', 'POST', { id: 999 })).status).toBe(404)
    expect((await send(app, '/api/credentials/test', 'POST', { id: 'x' })).status).toBe(400)
  })

  it('throttles per user and lets a save reuse the test of the same values', async () => {
    const { fetch, calls } = answering()
    const { app } = credentialApp({ fetch, testLimits: {} })

    expect((await send(app, '/api/credentials/test', 'POST', GITLAB_INPUT)).status).toBe(200)

    const probes = calls.length

    expect(await send(app, '/api/credentials', 'POST', GITLAB_INPUT)).toMatchObject({
      status: 201,
      body: { lastTest: { registry: { ok: 2 } } },
    })
    expect(calls).toHaveLength(probes)
    expect(
      await send(app, '/api/credentials/test', 'POST', { ...GITLAB_INPUT, username: 'other-bot' }),
    ).toMatchObject({ status: 429, body: { error: 'test_cooldown' } })
    expect(
      await send(app, '/api/credentials', 'POST', { ...GITLAB_INPUT, label: 'Other' }),
    ).toMatchObject({ status: 409, body: { error: 'duplicate_scope' } })
  })
})
