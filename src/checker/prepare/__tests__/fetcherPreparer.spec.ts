// @vitest-environment node
import { once } from 'node:events'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CLAIM, PULLED, testConfig } from '#checker/__tests__/checkFixtures.ts'
import { createFakeRunner, toolBehaviour } from '#checker/__tests__/fakeRunner.ts'
import { CheckFailure } from '#checker/CheckFailure.ts'
import { LOCAL_SECRET } from '#checker/fetcher/__tests__/fetchFixtures.ts'
import { createFetcherServer, type FetcherServerDeps } from '#checker/fetcher/fetcherServer.ts'
import { createFetcherPreparer } from '#checker/prepare/fetcherPreparer.ts'
import { postLocal } from '#checker/prepare/localHttp.ts'
import type { PrepareAnswer, PrepareRequest } from '#checker/prepare/prepareTypes.ts'
import { waitForFetcher } from '#checker/prepare/waitForFetcher.ts'
import { checkLayout } from '#checker/workspace/checkLayout.ts'
import type { ToolContext } from '#checker/workspace/runTool.ts'

const ANSWER: PrepareAnswer = {
  images: { prepared: [{ ...PULLED, dir: 'images/1-1.27' }], skipped: [] },
  source: { missing: 'no_credential' },
}

/**
 * Returns a preparation that runs until its signal fires.
 * @param {AbortSignal} signal - Abort signal of the preparation
 * @param {() => void} onStart - Called right away
 * @returns {Promise<never>} - Rejects once aborted
 */
const untilAborted = (signal: AbortSignal, onStart: () => void = () => undefined): Promise<never> =>
  new Promise((_resolve, reject) => {
    onStart()
    signal.addEventListener('abort', () => reject(new Error('stopped')))
  })

describe('fetcher preparer against the local endpoint', () => {
  let root = ''
  let stops: (() => Promise<void>)[] = []

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'sieb-link-'))
    stops = []
  })

  afterEach(async () => {
    await Promise.all(stops.map((stop) => stop()))
    await rm(root, { recursive: true, force: true })
  })

  /**
   * Starts the local endpoint on a free loopback port.
   * @param {Partial<FetcherServerDeps>} deps - Prepare and release replacements
   * @returns {Promise<string>} - Base URL
   */
  const serve = async (deps: Partial<FetcherServerDeps> = {}): Promise<string> => {
    const fetcher = createFetcherServer({
      secret: LOCAL_SECRET,
      prepare: async () => ANSWER,
      release: async () => undefined,
      log: () => undefined,
      ...deps,
    })

    fetcher.server.listen(0, '127.0.0.1')
    await once(fetcher.server, 'listening')
    stops.push(fetcher.stop)

    return `http://127.0.0.1:${(fetcher.server.address() as AddressInfo).port}`
  }

  /**
   * Prepares the test claim through the fetcher.
   * @param {string} url - Base URL of the endpoint
   * @param {object} options - Secret, time left and abort signal
   * @param {string} [options.secret] - Local secret the checker sends
   * @param {number} [options.remainingMs] - Time left of the check
   * @param {AbortSignal} [options.signal] - Abort signal of the check
   * @returns {Promise<object>} - Prepared check or error and the pulled images
   */
  const prepare = async (
    url: string,
    options: { secret?: string; remainingMs?: number; signal?: AbortSignal } = {},
  ) => {
    const config = testConfig(join(root, 'private'))
    const layout = checkLayout(config.workdir, CLAIM.checkId, join(root, 'shared'))
    const context: ToolContext = {
      runner: createFakeRunner(toolBehaviour()).runner,
      config,
      signal: options.signal ?? new AbortController().signal,
      log: () => undefined,
      remainingMs: () => options.remainingMs ?? 60_000,
    }
    const pulled: unknown[] = []
    const preparer = createFetcherPreparer(
      { url, secret: options.secret ?? LOCAL_SECRET },
      () => undefined,
      50,
    )

    await mkdir(layout.workspace, { recursive: true })

    return preparer
      .prepare(CLAIM, layout, context, (images) => pulled.push(...images))
      .then(
        (prepared) => ({ prepared, error: null, pulled }),
        (error: unknown) => ({ prepared: null, error: error as Error, pulled }),
      )
  }

  it('sends the claim images and the time left and returns the validated workspace', async () => {
    const requests: PrepareRequest[] = []
    const url = await serve({
      prepare: async (request) => {
        requests.push(request)

        return ANSWER
      },
    })
    const { prepared, pulled } = await prepare(url)

    expect(prepared).toEqual(ANSWER)
    expect(pulled).toEqual(ANSWER.images.prepared)
    expect(requests).toEqual([
      {
        checkId: 7,
        images: [{ imageRef: CLAIM.imageRef, imageDigest: null, tag: '1.27' }],
        timeoutMs: 60_000,
      },
    ])
  })

  it('rounds a fractional time left, which AbortSignal.timeout refuses', async () => {
    const requests: PrepareRequest[] = []
    const url = await serve({
      prepare: async (request) => {
        requests.push(request)

        return ANSWER
      },
    })
    const { prepared, error } = await prepare(url, { remainingMs: 614_997.580_333 })

    expect(error).toBeNull()
    expect(prepared).toEqual(ANSWER)
    expect(requests[0]?.timeoutMs).toBe(614_998)
  })

  it('names a refused local secret, a failed preparation and an invalid answer', async () => {
    const url = await serve({
      prepare: async (_request, _signal, onPulled) => {
        onPulled([PULLED])
        throw new CheckFailure('image pull failed: DENIED')
      },
    })

    expect((await prepare(url, { secret: 'w'.repeat(32) })).error?.message).toBe(
      'the fetcher refused the local secret, check SIEB_FETCHER_LOCAL_SECRET of both containers',
    )

    const failed = await prepare(url)

    expect(failed.error).toBeInstanceOf(CheckFailure)
    expect(failed.error?.message).toBe('image pull failed: DENIED')
    expect(failed.pulled).toEqual([PULLED])

    const broken = await serve({
      prepare: async () => ({ ...ANSWER, source: { missing: 'nope' } }) as never,
    })

    expect((await prepare(broken)).error?.message).toBe('the fetcher sent an invalid answer')
  })

  it('fails when the fetcher is unreachable or misses the deadline', async () => {
    const closed = await serve()

    await stops.pop()?.()
    expect((await prepare(closed)).error?.message).toMatch(
      /^the fetcher is unreachable: ECONNREFUSED/,
    )

    let aborted: AbortSignal | null = null
    const slow = await serve({
      prepare: (_request, signal) => untilAborted(signal, () => (aborted = signal)),
    })

    expect((await prepare(slow, { remainingMs: 0 })).error?.message).toBe(
      'image preparation timed out',
    )
    await vi.waitFor(() => expect(aborted?.aborted).toBe(true))
  })

  it('aborts the fetcher work when the check is cancelled and lets release wait for it', async () => {
    const events: string[] = []
    const url = await serve({
      prepare: (_request, signal) => {
        events.push('started')
        signal.addEventListener('abort', () => events.push('aborted'))

        return untilAborted(signal)
      },
      release: async (checkId) => {
        events.push(`release ${checkId}`)
      },
    })
    const cancel = new AbortController()
    const running = prepare(url, { signal: cancel.signal })

    await vi.waitFor(() => expect(events).toEqual(['started']))
    cancel.abort('cancelled or timed out in sieb')
    expect((await running).error?.name).toBe('AbortError')
    await createFetcherPreparer({ url, secret: LOCAL_SECRET }, () => undefined).release(7)
    expect(events).toEqual(['started', 'aborted', 'release 7'])
  })

  it('answers busy while a preparation runs and waits for readiness', async () => {
    let started = false
    const url = await serve({
      prepare: (_request, signal) => untilAborted(signal, () => (started = true)),
    })
    const first = prepare(url, { remainingMs: 100 })

    await vi.waitFor(() => expect(started).toBe(true))

    const second = await prepare(url)

    expect(second.error?.message).toBe('the fetcher is busy with another check')
    await first

    const logs: string[] = []

    await waitForFetcher(
      { url, secret: LOCAL_SECRET },
      new AbortController().signal,
      async () => undefined,
      (line) => logs.push(line),
    )
    expect(logs).toEqual([])
    await expect(
      waitForFetcher(
        { url, secret: 'w'.repeat(32) },
        new AbortController().signal,
        async () => undefined,
        () => undefined,
      ),
    ).rejects.toThrow('the fetcher refused the local secret')
  })

  it('refuses requests without the secret, other methods and invalid bodies', async () => {
    const url = await serve()
    const signal = new AbortController().signal
    const post = (secret: string, path: string, body: unknown) =>
      postLocal({ baseUrl: url, path, secret, body, signal }).then(({ status }) => status)

    expect(await post('', '/ready', {})).toBe(401)
    expect(await post(`${LOCAL_SECRET}x`, '/ready', {})).toBe(401)
    expect(await post(LOCAL_SECRET, '/ready', {})).toBe(204)
    expect(await post(LOCAL_SECRET, '/prepare', { checkId: 7, images: [], timeoutMs: 1 })).toBe(400)
    expect(
      await post(LOCAL_SECRET, '/prepare', {
        checkId: 7,
        images: [{ imageRef: '-x:1' }],
        timeoutMs: 1,
      }),
    ).toBe(400)
    expect(await post(LOCAL_SECRET, '/release', { checkId: 'x' })).toBe(400)
    expect(await post(LOCAL_SECRET, '/nope', {})).toBe(404)
    expect(
      (await fetch(`${url}/ready`, { headers: { authorization: `Bearer ${LOCAL_SECRET}` } }))
        .status,
    ).toBe(405)
  })
})
