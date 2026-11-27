// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { DatabaseSync } from 'node:sqlite'

import type { AccessScope } from '#core/accessScope.ts'
import { runCredentialTest } from '#server/credentials/runCredentialTest.ts'
import { buildSnapshot } from '#server/db/__tests__/dbFixtures.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import { applySnapshot } from '#server/sync/applySnapshot.ts'

const NOW = new Date('2026-06-01T12:00:00.000Z')
const DIGEST = `sha256:${'ab'.repeat(32)}`
const LOGIN = { username: 'x-access-token', secret: 'ghp_secret' }
const BASIC = `Basic ${Buffer.from('x-access-token:ghp_secret').toString('base64')}`
const FAST = { requestMs: 50, totalMs: 2000 }
const GITHUB: AccessScope = {
  id: 1,
  label: 'GitHub',
  uses: ['registry'],
  registryHost: 'ghcr.io',
  gitHost: null,
  pathPrefix: 'acme',
  repoMapping: null,
}
const ADVERTISEMENT = { 'content-type': 'application/x-git-upload-pack-advertisement' }

type Handler = (init: RequestInit) => Response | Promise<Response>

/** A fetch double that answers by method and URL without query and records every request */
interface FakeFetch {
  fetch: typeof globalThis.fetch
  calls: { method: string; url: string; init: RequestInit }[]
}

/**
 * Creates a fetch double; unknown requests answer 599 so a test sees them.
 * @param {Record<string, Handler>} routes - Handlers by "METHOD url-without-query"
 * @returns {FakeFetch} - Fetch and its recorded calls
 */
const fakeFetch = (routes: Record<string, Handler>): FakeFetch => {
  const calls: FakeFetch['calls'] = []
  /**
   * Records the request and answers it from the routes.
   * @param {string | URL | Request} input - Request URL
   * @param {RequestInit} init - Request options
   * @returns {Promise<Response>} - Answer of the matching handler
   */
  const fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input)
    const method = init.method ?? 'GET'
    const handler = routes[`${method} ${url.split('?')[0]}`]

    calls.push({ method, url, init })
    return handler === undefined ? new Response(null, { status: 599 }) : handler(init)
  }) as typeof globalThis.fetch

  return { fetch, calls }
}

/**
 * Returns the Authorization header a request sent.
 * @param {RequestInit} init - Request options
 * @returns {string | undefined} - Header value
 */
const authOf = (init: RequestInit): string | undefined =>
  (init.headers as Record<string, string> | undefined)?.Authorization

/**
 * Answers 401 with a Bearer challenge.
 * @param {string} realm - Token realm
 * @param {string} service - Service
 * @returns {Response} - Response
 */
const challenge = (realm: string, service: string): Response =>
  new Response(null, {
    status: 401,
    headers: {
      'www-authenticate': `Bearer realm="${realm}",service="${service}",scope="repository:x:pull"`,
    },
  })

/**
 * Opens a database with findings on ghcr.io, Docker Hub and a self-hosted GitLab registry.
 * @returns {DatabaseSync} - Seeded database
 */
const seeded = (): DatabaseSync => {
  const db = openDatabase(MEMORY_DB)

  applySnapshot(
    db,
    buildSnapshot([
      { imageRef: 'ghcr.io/acme/app', imageDigest: DIGEST },
      { imageRef: 'ghcr.io/acme/tool', imageTag: '2.0' },
      { imageRef: 'ghcr.io/other/x' },
      { imageRef: 'index.docker.io/acme/web' },
      { imageRef: 'registry.example.com/acme/shop' },
    ]),
    NOW,
  )

  return db
}

describe('registry test', () => {
  it('follows the bearer flow of ghcr.io and resolves only covered images', async () => {
    const { fetch, calls } = fakeFetch({
      [`HEAD https://ghcr.io/v2/acme/app/manifests/${DIGEST}`]: (init) =>
        authOf(init) === 'Bearer t1'
          ? new Response(null, { status: 200 })
          : challenge('https://ghcr.io/token', 'ghcr.io'),
      'HEAD https://ghcr.io/v2/acme/tool/manifests/2.0': (init) =>
        authOf(init) === undefined
          ? challenge('https://ghcr.io/token', 'ghcr.io')
          : new Response(null, { status: 404 }),
      'GET https://ghcr.io/token': (init) =>
        authOf(init) === BASIC
          ? Response.json({ token: 't1' })
          : new Response(null, { status: 401 }),
    })
    const result = await runCredentialTest(seeded(), {
      scope: GITHUB,
      provider: 'github',
      scopes: [GITHUB],
      login: LOGIN,
      fetch,
      timings: FAST,
      now: NOW,
    })

    expect(result).toEqual({
      at: NOW.toISOString(),
      registry: {
        checked: 2,
        ok: 1,
        failures: [{ target: 'ghcr.io/acme/tool', reason: 'not found' }],
        denied: 0,
        blocked: 0,
      },
      git: null,
    })
    expect(calls.every((call) => call.init.redirect === 'manual')).toBe(true)
    expect(calls.some((call) => call.url.includes('/other/'))).toBe(false)
    expect(calls.find((call) => call.url.startsWith('https://ghcr.io/token'))?.url).toContain(
      'scope=repository%3Aacme%2Fapp%3Apull',
    )
  })

  it('uses registry-1.docker.io and auth.docker.io for Docker Hub and reports a refused token', async () => {
    const hub = { ...GITHUB, registryHost: 'docker.io' }
    const { fetch } = fakeFetch({
      'HEAD https://registry-1.docker.io/v2/acme/web/manifests/1.27.0': () =>
        challenge('https://auth.docker.io/token', 'registry.docker.io'),
      'GET https://auth.docker.io/token': () => new Response('{}', { status: 401 }),
    })
    const result = await runCredentialTest(seeded(), {
      scope: hub,
      provider: 'dockerhub',
      scopes: [hub],
      login: LOGIN,
      fetch,
      timings: FAST,
      now: NOW,
    })

    expect(result.registry).toEqual({
      checked: 1,
      ok: 0,
      failures: [{ target: 'index.docker.io/acme/web', reason: '401 unauthorized' }],
      denied: 1,
      blocked: 0,
    })
  })

  it('never sends the credential to a realm on another host or after a redirect', async () => {
    const { fetch, calls } = fakeFetch({
      [`HEAD https://ghcr.io/v2/acme/app/manifests/${DIGEST}`]: () =>
        challenge('https://evil.example.org/token', 'ghcr.io'),
      'HEAD https://ghcr.io/v2/acme/tool/manifests/2.0': () =>
        new Response(null, { status: 307, headers: { location: 'https://evil.example.org/x' } }),
    })
    const result = await runCredentialTest(seeded(), {
      scope: GITHUB,
      provider: 'github',
      scopes: [GITHUB],
      login: LOGIN,
      fetch,
      timings: FAST,
      now: NOW,
    })

    expect(result.registry?.failures).toEqual([
      { target: 'ghcr.io/acme/app', reason: 'token realm on another host' },
      { target: 'ghcr.io/acme/tool', reason: 'redirect refused' },
    ])
    expect(calls.some((call) => call.url.includes('evil.example.org'))).toBe(false)
    expect(calls.some((call) => authOf(call.init) !== undefined)).toBe(false)
  })

  it('reports a timeout and an unreachable host', async () => {
    const { fetch } = fakeFetch({
      [`HEAD https://ghcr.io/v2/acme/app/manifests/${DIGEST}`]: (init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
      'HEAD https://ghcr.io/v2/acme/tool/manifests/2.0': () => {
        throw new TypeError('fetch failed')
      },
    })
    const result = await runCredentialTest(seeded(), {
      scope: GITHUB,
      provider: 'github',
      scopes: [GITHUB],
      login: LOGIN,
      fetch,
      timings: FAST,
      now: NOW,
    })

    expect(result.registry?.failures).toEqual([
      { target: 'ghcr.io/acme/app', reason: 'timeout' },
      { target: 'ghcr.io/acme/tool', reason: 'unreachable' },
    ])
  })
})

describe('git test', () => {
  const gitlab: AccessScope = {
    id: 2,
    label: 'GitLab',
    uses: ['registry', 'git'],
    registryHost: 'registry.example.com',
    gitHost: 'gitlab.example.com',
    pathPrefix: 'acme',
    repoMapping: {
      registryPrefix: 'registry.example.com/acme',
      repoPrefix: 'gitlab.example.com/acme',
    },
  }

  it('reads the refs of mapped repositories and of checked out sources with basic auth', async () => {
    const db = seeded()

    db.exec(
      `INSERT INTO checks (finding_id, vuln_id, image_ref, requested_by, state, created_at, finished_at, source)
       VALUES (1, 'CVE-1', 'x', 'alice', 'cancelled', 't', 't',
         '{"repoUrl":"https://gitlab.example.com/acme/lib.git","revision":null,"fromLabel":true}')`,
    )

    const { fetch, calls } = fakeFetch({
      'HEAD https://registry.example.com/v2/acme/shop/manifests/1.27.0': () =>
        new Response(null, { status: 200 }),
      'GET https://gitlab.example.com/acme/shop.git/info/refs': (init) =>
        authOf(init) === BASIC
          ? new Response('001e', { headers: ADVERTISEMENT })
          : new Response(null, { status: 401 }),
      'GET https://gitlab.example.com/acme/lib.git/info/refs': () =>
        new Response(null, { status: 401 }),
    })
    const result = await runCredentialTest(db, {
      scope: gitlab,
      provider: 'gitlab',
      scopes: [gitlab],
      login: LOGIN,
      fetch,
      timings: FAST,
      now: NOW,
    })

    expect(result.registry).toEqual({ checked: 1, ok: 1, failures: [], denied: 0, blocked: 0 })
    expect(result.git).toEqual({
      checked: 2,
      ok: 1,
      failures: [{ target: 'https://gitlab.example.com/acme/lib.git', reason: '401 unauthorized' }],
      denied: 1,
      blocked: 0,
    })
    expect(calls.find((call) => call.url.includes('shop.git'))?.url).toBe(
      'https://gitlab.example.com/acme/shop.git/info/refs?service=git-upload-pack',
    )
  })

  it('derives the repositories of a git-only GitHub credential from the default mapping', async () => {
    const git: AccessScope = {
      ...GITHUB,
      id: 2,
      uses: ['git'],
      registryHost: null,
      gitHost: 'github.com',
    }
    const { fetch, calls } = fakeFetch({
      'GET https://github.com/acme/app.git/info/refs': () =>
        new Response('', { headers: ADVERTISEMENT }),
    })
    const result = await runCredentialTest(seeded(), {
      scope: git,
      provider: 'github',
      scopes: [git],
      login: LOGIN,
      fetch,
      timings: FAST,
      now: NOW,
    })

    expect(result.git).toMatchObject({ checked: 2, ok: 1 })
    expect(calls.map((call) => call.url.split('?')[0])).toEqual([
      'https://github.com/acme/app.git/info/refs',
      'https://github.com/acme/tool.git/info/refs',
    ])
  })

  it('refuses a login page and a redirect instead of the refs advertisement', async () => {
    const { fetch } = fakeFetch({
      'GET https://gitlab.example.com/acme/shop.git/info/refs': () =>
        new Response('<html>', { headers: { 'content-type': 'text/html' } }),
    })
    const gitOnly = { ...gitlab, uses: ['git' as const] }
    const html = await runCredentialTest(seeded(), {
      scope: gitOnly,
      provider: 'gitlab',
      scopes: [gitlab],
      login: LOGIN,
      fetch,
      timings: FAST,
      now: NOW,
    })
    const redirect = await runCredentialTest(seeded(), {
      scope: gitOnly,
      provider: 'gitlab',
      scopes: [gitlab],
      login: LOGIN,
      fetch: fakeFetch({
        'GET https://gitlab.example.com/acme/shop.git/info/refs': () =>
          new Response(null, {
            status: 302,
            headers: { location: 'https://gitlab.example.com/users/sign_in' },
          }),
      }).fetch,
      timings: FAST,
      now: NOW,
    })

    expect(html.registry).toBeNull()
    expect(html.git?.failures).toEqual([
      { target: 'https://gitlab.example.com/acme/shop.git', reason: 'unexpected answer' },
    ])
    expect(redirect.git?.failures).toEqual([
      { target: 'https://gitlab.example.com/acme/shop.git', reason: 'redirect refused' },
    ])
  })
})
