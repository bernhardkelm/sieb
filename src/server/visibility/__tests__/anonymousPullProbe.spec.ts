// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { RegistryTarget } from '#server/credentials/probe/registryProbe.ts'
import { probeAnonymousPull } from '#server/visibility/anonymousPullProbe.ts'

const TARGET: RegistryTarget = {
  imageRef: 'ghcr.io/acme/app',
  host: 'ghcr.io',
  path: 'acme/app',
  reference: 'sha256:' + 'a'.repeat(64),
}
const CHALLENGE = 'Bearer realm="https://ghcr.io/token",service="ghcr.io"'

/** One request the fake registry saw */
interface Seen {
  url: string
  method: string
  authorization: string | null
}

/**
 * Creates a fetch that answers queued responses in order and records each request.
 * @param {Response[]} answers - Responses, one per request
 * @returns {{ fetch: typeof globalThis.fetch; seen: Seen[] }} - Fetch and the requests
 */
const fakeRegistry = (answers: Response[]) => {
  const seen: Seen[] = []
  const fetch = (async (input: string | URL, init: RequestInit = {}) => {
    seen.push({
      url: String(input),
      method: init.method ?? 'GET',
      authorization: new Headers(init.headers).get('authorization'),
    })

    const next = answers.shift()

    if (next === undefined) {
      throw new Error('unexpected request')
    }

    return next
  }) as typeof globalThis.fetch

  return { fetch, seen }
}

/**
 * Runs the probe against a fake registry.
 * @param {Response[]} answers - Responses in order
 * @returns {Promise<{ outcome: Awaited<ReturnType<typeof probeAnonymousPull>>; seen: Seen[] }>} - Outcome and requests
 */
const probe = async (answers: Response[]) => {
  const { fetch, seen } = fakeRegistry(answers)
  const outcome = await probeAnonymousPull(
    { fetch, signal: new AbortController().signal, requestMs: 1000 },
    TARGET,
  )

  return { outcome, seen }
}

/**
 * Builds a 401 answer with a challenge.
 * @param {string} challenge - WWW-Authenticate value
 * @returns {Response} - Response
 */
const unauthorized = (challenge: string): Response =>
  new Response(null, { status: 401, headers: { 'www-authenticate': challenge } })

/**
 * Builds a token answer.
 * @param {Record<string, unknown>} body - JSON body
 * @returns {Response} - Response
 */
const tokenAnswer = (body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), { status: 200 })

/**
 * Runs the probe for another target against a fake registry answering 200.
 * @param {RegistryTarget} target - Target
 * @returns {Promise<{ seen: Seen[] }>} - Requests
 */
const fakeRegistryRun = async (target: RegistryTarget) => {
  const { fetch, seen } = fakeRegistry([new Response(null, { status: 200 })])

  await probeAnonymousPull({ fetch, signal: new AbortController().signal, requestMs: 1000 }, target)

  return { seen }
}

describe('probeAnonymousPull', () => {
  it('counts an anonymous 200 on the manifest as public', async () => {
    const { outcome, seen } = await probe([new Response(null, { status: 200 })])

    expect(outcome).toEqual({ result: 'public', reason: null })
    expect(seen).toEqual([
      {
        url: `https://ghcr.io/v2/acme/app/manifests/${TARGET.reference}`,
        method: 'HEAD',
        authorization: null,
      },
    ])
  })

  it('follows a Bearer challenge with an anonymous token and never sends a credential', async () => {
    const { outcome, seen } = await probe([
      unauthorized(CHALLENGE),
      tokenAnswer({ token: 'anon-token' }),
      new Response(null, { status: 200 }),
    ])

    expect(outcome).toEqual({ result: 'public', reason: null })
    expect(seen.map((request) => request.method)).toEqual(['HEAD', 'GET', 'HEAD'])
    expect(seen[0]?.authorization).toBeNull()
    expect(seen[1]?.authorization).toBeNull()
    expect(seen[1]?.url).toBe(
      'https://ghcr.io/token?service=ghcr.io&scope=repository%3Aacme%2Fapp%3Apull',
    )
    expect(seen[2]?.authorization).toBe('Bearer anon-token')
  })

  it('names the manifest refused with the anonymous token restricted', async () => {
    for (const status of [401, 403]) {
      const { outcome } = await probe([
        unauthorized(CHALLENGE),
        tokenAnswer({ access_token: 'anon-token' }),
        new Response(null, { status }),
      ])

      expect(outcome.result).toBe('restricted')
    }
  })

  it('names a refused token restricted', async () => {
    for (const status of [401, 403]) {
      const { outcome } = await probe([unauthorized(CHALLENGE), new Response('denied', { status })])

      expect(outcome).toEqual({
        result: 'restricted',
        reason: status === 401 ? '401 unauthorized' : '403 forbidden',
      })
    }
  })

  it('names a Basic challenge restricted without asking for a token', async () => {
    const { outcome, seen } = await probe([unauthorized('Basic realm="registry"')])

    expect(outcome).toEqual({ result: 'restricted', reason: '401 unauthorized' })
    expect(seen).toHaveLength(1)
  })

  it('names a missing manifest, a server error and a token answer without token failed', async () => {
    expect((await probe([new Response(null, { status: 404 })])).outcome).toEqual({
      result: 'failed',
      reason: 'not found',
    })
    expect((await probe([new Response(null, { status: 503 })])).outcome).toEqual({
      result: 'failed',
      reason: 'HTTP 503',
    })
    expect((await probe([unauthorized(CHALLENGE), tokenAnswer({})])).outcome).toEqual({
      result: 'failed',
      reason: 'no token',
    })
    expect(
      (await probe([unauthorized(CHALLENGE), new Response('{', { status: 200 })])).outcome,
    ).toEqual({ result: 'failed', reason: 'invalid token answer' })
  })

  it('names an aborted or timed out probe failed with timeout', async () => {
    for (const name of ['AbortError', 'TimeoutError']) {
      const fetch = (async () => {
        throw new DOMException('stopped', name)
      }) as typeof globalThis.fetch
      const outcome = await probeAnonymousPull(
        { fetch, signal: new AbortController().signal, requestMs: 1000 },
        TARGET,
      )

      expect(outcome).toEqual({ result: 'failed', reason: 'timeout' })
    }
  })

  it('asks Docker Hub through its API host', async () => {
    const { seen } = await fakeRegistryRun({ ...TARGET, host: 'docker.io', path: 'library/nginx' })

    expect(seen[0]?.url).toMatch(/^https:\/\/registry-1\.docker\.io\/v2\/library\/nginx\//u)
  })
})
