// @vitest-environment node
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { performance } from 'node:perf_hooks'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkerClaim, WorkerHeartbeat, WorkerResult } from '#core/check.ts'
import { CLAIM, PULLED, testConfig } from '#checker/__tests__/checkFixtures.ts'
import { createFakeRunner, toolBehaviour, type Behaviour } from '#checker/__tests__/fakeRunner.ts'
import type { WorkerApi } from '#checker/api/workerApi.ts'
import { runCheck } from '#checker/check/runCheck.ts'
import { wipeStaleChecks } from '#checker/check/wipe.ts'

describe('runCheck', () => {
  let workdir = ''

  beforeEach(async () => {
    workdir = await mkdtemp(join(tmpdir(), 'sieb-check-'))
  })

  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true })
  })

  /**
   * Runs the test claim against fake tools and a fake API.
   * @param {object} options - Tool overrides, heartbeat answer and stop signal
   * @param {Record<string, Behaviour>} [options.tools] - Tool behaviours to replace
   * @param {(body: WorkerHeartbeat) => 'ok' | 'abort'} [options.heartbeat] - Heartbeat answer
   * @param {AbortSignal} [options.stopSignal] - Worker stop signal
   * @param {WorkerClaim} [options.claim] - Claim to run instead of CLAIM
   * @param {() => number} [options.now] - Monotonic clock
   * @param {(body: WorkerResult) => Promise<void>} [options.result] - Called with each posted result
   * @returns {Promise<object>} - Result, posted results, spawned processes and leftover entries
   */
  const run = async (
    options: {
      tools?: Record<string, Behaviour>
      heartbeat?: (body: WorkerHeartbeat) => 'ok' | 'abort'
      stopSignal?: AbortSignal
      claim?: WorkerClaim
      now?: () => number
      result?: (body: WorkerResult) => Promise<void>
    } = {},
  ) => {
    const results: WorkerResult[] = []
    const api: WorkerApi = {
      claim: vi.fn<WorkerApi['claim']>(),
      heartbeat: async (_checkId, body) => options.heartbeat?.(body) ?? 'ok',
      result: async (_checkId, body) => {
        results.push(body)
        await options.result?.(body)
      },
    }
    const { runner, spawned } = createFakeRunner(toolBehaviour(options.tools))
    const result = await runCheck(options.claim ?? CLAIM, {
      api,
      runner,
      config: testConfig(workdir),
      now: options.now ?? (() => performance.now()),
      stopSignal: options.stopSignal ?? new AbortController().signal,
      log: () => undefined,
      resultRetryMs: 1,
    })

    return { result, results, spawned, left: await readdir(workdir) }
  }

  it('reports a successful check with usage and reply and wipes the directory', async () => {
    const { result, results, left } = await run()

    expect(result).toMatchObject({
      status: 'done',
      error: null,
      reply: expect.stringContaining('not_affected'),
      usage: expect.objectContaining({ inputTokens: 1200, costUsd: 0.42, turns: 7 }),
      pulledDigest: PULLED.digest,
    })
    expect(result.reply).toContain(
      `\n\nPulled ${PULLED.ref}, resolved from the tag at check time; the scanned digest is unknown.`,
    )
    expect(results).toEqual([result])
    expect(left).toEqual([])
  })

  it('resolves a tag with crane digest and pulls the scanned digest without resolving', async () => {
    const tagged = await run()

    expect(
      tagged.spawned.map(({ spec }) =>
        spec.command === 'crane' ? `crane ${spec.args[0]}` : spec.command,
      ),
    ).toEqual(['crane digest', 'crane config', 'crane export', 'tar', 'syft', 'claude'])

    const digest = `sha256:${'b'.repeat(64)}`
    const scanned = await run({
      claim: { ...CLAIM, imageRef: `docker.io/library/nginx@${digest}`, imageDigest: digest },
    })

    expect(scanned.spawned.map(({ spec }) => spec.args[0])).not.toContain('digest')
    expect(scanned.spawned[0]?.spec.args).toContain(`docker.io/library/nginx@${digest}`)
    expect(scanned.result.reply).toContain(
      `Pulled docker.io/library/nginx@${digest}, the scanned digest.`,
    )
  })

  it('hands the Claude credential over on fd 3, never in env or argv', async () => {
    const { spawned } = await run()
    const claude = spawned.find((proc) => proc.spec.command === 'claude')

    expect(claude?.fd3Input).toBe('claude-oauth-token')
    expect(JSON.stringify([claude?.spec.env, claude?.spec.args])).not.toContain(
      'claude-oauth-token',
    )
    expect(spawned.filter((proc) => proc.fd3Input !== undefined)).toHaveLength(1)
  })

  it('sends the result before wiping the directory', async () => {
    let present: string[] = []
    const { left } = await run({
      result: async () => {
        present = await readdir(workdir)
      },
    })

    expect(present).toEqual(['check-7'])
    expect(left).toEqual([])
  })

  it('keeps durationMs non-negative on the monotonic clock', async () => {
    let tick = 1000
    const { result } = await run({ now: () => (tick -= 10) })

    expect(result.durationMs).toBe(0)
  })

  it('wipes the directory when preparing fails', async () => {
    const { result, left } = await run({
      tools: {
        'crane config': (proc) => {
          proc.stderr.write('MANIFEST_UNKNOWN\n')
          proc.exit(1)
        },
      },
    })

    expect(result).toMatchObject({
      status: 'failed',
      error: `image pull failed: MANIFEST_UNKNOWN (Pulled ${PULLED.ref}, resolved from the tag at check time; the scanned digest is unknown.)`,
      pulledDigest: PULLED.digest,
    })
    expect(left).toEqual([])
  })

  it('wipes the directory when Claude fails', async () => {
    const { result, left } = await run({
      tools: {
        claude: (proc) => {
          proc.stdout.write('{"is_error":true,"result":"Invalid OAuth token"}')
          proc.exit(1)
        },
      },
    })

    expect(result).toMatchObject({
      status: 'failed',
      error: expect.stringMatching(/^Claude reported an error: Invalid OAuth token \(Pulled /),
    })
    expect(left).toEqual([])
  })

  it('kills Claude and fails the check when a heartbeat answers 409', async () => {
    const { result, spawned, left } = await run({
      heartbeat: (body) => (body.phase === 'investigating' ? 'abort' : 'ok'),
      tools: { claude: () => undefined },
    })

    expect(spawned.find((proc) => proc.spec.command === 'claude')?.killed).toBe(true)
    expect(result).toMatchObject({
      status: 'failed',
      error: expect.stringMatching(/^cancelled or timed out in sieb \(Pulled /),
      usage: null,
    })
    expect(left).toEqual([])
  })

  it('aborts a running export when the worker stops', async () => {
    const stop = new AbortController()
    const { result, left } = await run({
      stopSignal: stop.signal,
      tools: {
        'crane export': () => {
          stop.abort('worker stopped')
        },
      },
    })

    expect(result).toMatchObject({
      status: 'failed',
      error: expect.stringMatching(/^worker stopped/),
    })
    expect(left).toEqual([])
  })
})

describe('wipeStaleChecks', () => {
  it('removes leftover check directories only', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'sieb-stale-'))

    await Promise.all(
      ['check-1', 'check-2/home', 'keep'].map((dir) =>
        mkdir(join(workdir, dir), { recursive: true }),
      ),
    )
    await wipeStaleChecks(workdir, () => undefined)

    expect(await readdir(workdir)).toEqual(['keep'])
    await rm(workdir, { recursive: true, force: true })
  })
})
