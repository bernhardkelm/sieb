// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkerResult } from '#core/check.ts'
import { CLAIM, PULLED, testConfig } from '#checker/__tests__/checkFixtures.ts'
import { createFakeRunner, toolBehaviour, type Behaviour } from '#checker/__tests__/fakeRunner.ts'
import type { WorkerApi } from '#checker/api/workerApi.ts'
import { runCheck } from '#checker/check/runCheck.ts'
import { CheckFailure } from '#checker/CheckFailure.ts'
import { CREDENTIAL_HINT, localPreparer } from '#checker/prepare/localPreparer.ts'
import type { PreparedCheck, WorkspacePreparer } from '#checker/prepare/prepareTypes.ts'

const SOURCE = {
  repoUrl: 'https://github.com/acme/app',
  revision: 'c'.repeat(40),
  fromLabel: true,
  refKind: 'label' as const,
  ref: null,
}
const PREPARED: PreparedCheck = {
  images: { prepared: [{ ...PULLED, dir: 'images/1-1.27' }], skipped: [] },
  source: { checked: SOURCE },
}

describe('runCheck with the fetcher', () => {
  let root = ''

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'sieb-two-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  /**
   * Runs the test claim with a preparer and fake tools.
   * @param {WorkspacePreparer} preparer - Preparer to use
   * @param {object} options - Fetcher mode and tool overrides
   * @param {boolean} [options.fetcher] - Two-container mode with a shared directory
   * @param {Record<string, Behaviour>} [options.tools] - Tool behaviours to replace
   * @returns {Promise<object>} - Result, spawned processes and what was left in the private dir
   */
  const run = async (
    preparer: WorkspacePreparer,
    options: { fetcher?: boolean; tools?: Record<string, Behaviour> } = {},
  ) => {
    const config = {
      ...testConfig(join(root, 'private')),
      sharedDir: join(root, 'shared'),
      fetcher:
        options.fetcher === false ? null : { url: 'http://127.0.0.1:3102', secret: 'l'.repeat(32) },
    }
    const files: Record<string, string> = {}
    const { runner, spawned } = createFakeRunner(
      toolBehaviour({
        claude: async (proc) => {
          const settings = proc.spec.args[proc.spec.args.indexOf('--settings') + 1] ?? ''

          files.settings = await readFile(settings, 'utf8')
          proc.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', result: 'ok' }))
          proc.exit(0)
        },
        ...options.tools,
      }),
    )
    const posted: WorkerResult[] = []
    const api: WorkerApi = {
      claim: vi.fn<WorkerApi['claim']>(),
      heartbeat: async () => 'ok',
      result: async (_checkId, body) => {
        posted.push(body)
      },
    }

    await mkdir(config.workdir, { recursive: true })

    const result = await runCheck(CLAIM, {
      api,
      runner,
      config,
      preparer,
      now: () => performance.now(),
      stopSignal: new AbortController().signal,
      log: () => undefined,
      resultRetryMs: 1,
    })

    return { result, posted, spawned, files, left: await readdir(config.workdir), config }
  }

  it('runs Claude in the shared workspace, reports the source and releases the workspace', async () => {
    const calls: string[] = []
    const preparer: WorkspacePreparer = {
      prepare: async (_claim, layout) => {
        calls.push(`prepare ${layout.workspace}`)
        await mkdir(join(layout.workspace, 'images/1-1.27'), { recursive: true })

        return PREPARED
      },
      release: async (checkId) => {
        calls.push(`release ${checkId}`)
      },
    }
    const { result, posted, spawned, files, left, config } = await run(preparer)
    const claude = spawned.find(({ spec }) => spec.command === 'claude')
    const workspace = join(config.sharedDir, 'check-7')

    expect(result).toMatchObject({ status: 'done', source: SOURCE, pulledDigest: PULLED.digest })
    expect(posted).toEqual([result])
    expect(calls).toEqual([`prepare ${workspace}`, 'release 7'])
    expect(claude?.spec.cwd).toBe(workspace)
    expect(claude?.spec.args[1]).toContain(`source/: the repository ${SOURCE.repoUrl}`)
    expect(spawned.filter(({ spec }) => spec.command !== 'claude')).toEqual([])
    expect(JSON.parse(files.settings ?? '{}').permissions.deny).toContain(
      `Read(/${join(config.workdir, 'check-7')}/**)`,
    )
    expect(left).toEqual([])
  })

  it('fails with the fetcher reason and the pulled note, and still releases', async () => {
    const release = vi.fn<WorkspacePreparer['release']>(async () => undefined)
    const { result } = await run({
      prepare: async (_claim, _layout, _context, onPulled) => {
        onPulled([PULLED])
        throw new CheckFailure('image pull failed: DENIED')
      },
      release,
    })

    expect(result).toMatchObject({
      status: 'failed',
      error: expect.stringMatching(/^image pull failed: DENIED \(Pulled /),
      source: null,
      pulledDigest: PULLED.digest,
    })
    expect(release).toHaveBeenCalledWith(7)
  })

  it('names the missing fetcher when a single container pull needs a credential', async () => {
    const { result, spawned } = await run(localPreparer, {
      fetcher: false,
      tools: {
        'crane digest': (proc) => {
          proc.stderr.write(
            'Error: GET https://ghcr.io/token: UNAUTHORIZED: authentication required\n',
          )
          proc.exit(1)
        },
      },
    })

    expect(result.status).toBe('failed')
    expect(result.error?.startsWith(`${CREDENTIAL_HINT}: image pull failed: Error: GET`)).toBe(true)
    expect(result.source).toBeNull()
    expect(spawned.map(({ spec }) => spec.command)).toEqual(['crane'])
  })

  it('keeps the 0.5 behaviour in single-container mode without source', async () => {
    const { result, spawned } = await run(localPreparer, { fetcher: false })
    const prompt = spawned.find(({ spec }) => spec.command === 'claude')?.spec.args[1] ?? ''

    expect(result).toMatchObject({ status: 'done', source: null })
    expect(prompt).toContain('There is no source/ (this worker runs without the fetcher container')
  })
})
