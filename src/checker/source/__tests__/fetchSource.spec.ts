// @vitest-environment node
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { SourceGrant } from '#core/privateAccess.ts'
import { PULLED } from '#checker/__tests__/checkFixtures.ts'
import { createFakeRunner, toolBehaviour, type Behaviour } from '#checker/__tests__/fakeRunner.ts'
import {
  COMMIT,
  fakeGit,
  fakeSieb,
  fetcherConfig,
  GIT_SECRET,
  HEAD_COMMIT,
} from '#checker/fetcher/__tests__/fetchFixtures.ts'
import { fetchLayout } from '#checker/fetcher/fetchLayout.ts'
import { createSecretList } from '#checker/fetcher/secretList.ts'
import { fetchSource } from '#checker/source/fetchSource.ts'

const NESTED = 'https://gitlab.com/example/group/app.git'
const PROJECT = 'https://gitlab.com/example/group.git'
const ANONYMOUS: SourceGrant = {
  repoUrls: [NESTED, PROJECT],
  revision: null,
  username: null,
  secret: null,
}

/**
 * Wraps fake git so fetches of the listed refs fail like a missing ref or a refused login.
 * @param {(url: string, ref: string) => boolean} fails - Whether a fetch of a URL and ref fails
 * @returns {Behaviour} - git behaviour
 */
const gitFailing =
  (fails: (url: string, ref: string) => boolean): Behaviour =>
  async (proc) => {
    const { args } = proc.spec

    if (args[0] === 'fetch' && fails(args.at(-2) ?? '', args.at(-1) ?? '')) {
      proc.stderr.write('fatal: could not read Username for https://gitlab.com\n')
      proc.exit(128)

      return
    }

    await fakeGit(proc)
  }

describe('fetchSource', () => {
  let root = ''

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'sieb-source-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  /**
   * Runs the source step of check 7 for one grant.
   * @param {SourceGrant} grant - Grant sieb answers
   * @param {Behaviour} git - git behaviour
   * @param {string | null} tag - Tag of the primary image
   * @returns {Promise<object>} - Outcome, git processes, secret list and layout
   */
  const run = async (grant: SourceGrant, git: Behaviour = fakeGit, tag: string | null = '1.4') => {
    const config = fetcherConfig(root)
    const layout = fetchLayout(config.workdir, config.sharedDir, 7)
    const secrets = createSecretList()
    const { runner, spawned } = createFakeRunner(toolBehaviour({ git }))

    await mkdir(layout.home, { recursive: true })
    await mkdir(layout.tmp, { recursive: true })

    const outcome = await fetchSource(
      7,
      { ...PULLED, tag, dir: 'images/1-1.4' },
      {
        api: fakeSieb({ source: async () => ({ grant }) }).api,
        runner,
        config,
        layout,
        signal: new AbortController().signal,
        remainingMs: () => 60_000,
        secrets,
        log: () => undefined,
        pollMs: 5,
      },
    )
    const fetches = spawned
      .filter(({ spec }) => spec.args[0] === 'fetch')
      .map(({ spec }) => `${spec.args.at(-2)} ${spec.args.at(-1)}`)

    return { outcome, spawned, secrets, layout, fetches }
  }

  it('clones a public repository anonymously, without any Authorization header', async () => {
    const { outcome, spawned, secrets } = await run(
      ANONYMOUS,
      gitFailing(() => false),
      null,
    )

    expect(outcome).toEqual({
      checked: {
        repoUrl: NESTED,
        revision: HEAD_COMMIT,
        fromLabel: false,
        refKind: 'default_branch',
        ref: null,
      },
    })
    expect(spawned.map(({ spec }) => spec.args[0])).toEqual([
      'init',
      'fetch',
      'checkout',
      'rev-parse',
    ])
    expect(JSON.stringify(spawned.map(({ spec }) => spec.env))).not.toMatch(
      /Authorization|extraHeader/u,
    )
    expect(secrets.redact('nothing to hide')).toBe('nothing to hide')
  })

  it('tries the candidates in order and reports needs_credential when none clones', async () => {
    const { outcome, fetches, layout } = await run(
      ANONYMOUS,
      gitFailing(() => true),
    )

    expect(outcome).toEqual({ missing: 'needs_credential' })
    expect(fetches).toEqual([
      `${NESTED} refs/tags/1.4`,
      `${NESTED} refs/tags/v1.4`,
      `${NESTED} HEAD`,
      `${PROJECT} refs/tags/1.4`,
      `${PROJECT} refs/tags/v1.4`,
      `${PROJECT} HEAD`,
    ])
    expect(await readdir(layout.workspace).catch(() => [])).toEqual([])
  })

  it('takes the next candidate when the first does not exist', async () => {
    const { outcome } = await run(
      ANONYMOUS,
      gitFailing((url) => url === NESTED),
    )

    expect(outcome).toMatchObject({ checked: { repoUrl: PROJECT, refKind: 'tag', ref: '1.4' } })
  })

  it('reports a failed clone with a login as clone_failed', async () => {
    const { outcome } = await run(
      { ...ANONYMOUS, username: 'deploy', secret: GIT_SECRET },
      gitFailing(() => true),
    )

    expect(outcome).toEqual({ missing: 'clone_failed' })
  })

  it('checks out the git tag matching the image tag, then with a v prefix', async () => {
    const { outcome, fetches } = await run(
      { ...ANONYMOUS, repoUrls: [PROJECT] },
      gitFailing((_url, ref) => ref === 'refs/tags/1.4'),
    )

    expect(fetches).toEqual([`${PROJECT} refs/tags/1.4`, `${PROJECT} refs/tags/v1.4`])
    expect(outcome).toEqual({
      checked: {
        repoUrl: PROJECT,
        revision: HEAD_COMMIT,
        fromLabel: false,
        refKind: 'tag',
        ref: 'v1.4',
      },
    })
  })

  it('tries no tag for latest or a digest-only image', async () => {
    for (const tag of ['latest', null]) {
      const { fetches, outcome } = await run({ ...ANONYMOUS, repoUrls: [PROJECT] }, fakeGit, tag)

      expect(fetches).toEqual([`${PROJECT} HEAD`])
      expect(outcome).toMatchObject({ checked: { refKind: 'default_branch' } })
    }
  })

  it('fetches the label commit first and sets the login only for the URL being fetched', async () => {
    const login = Buffer.from(`deploy:${GIT_SECRET}`).toString('base64')
    const { outcome, spawned } = await run(
      { repoUrls: [NESTED, PROJECT], revision: COMMIT, username: 'deploy', secret: GIT_SECRET },
      gitFailing((url) => url === NESTED),
    )

    expect(outcome).toMatchObject({
      checked: { repoUrl: PROJECT, revision: COMMIT, refKind: 'label', ref: null },
    })

    const local = spawned.filter(({ spec }) => spec.args[0] !== 'fetch')
    const headers = spawned
      .filter(({ spec }) => spec.args[0] === 'fetch')
      .map(({ spec }) =>
        Object.entries(spec.env)
          .filter(([, value]) => value.includes(login))
          .map(([key]) => `${spec.args.at(-2)} ${spec.env[key.replace('VALUE', 'KEY')]}`),
      )

    expect(local.some(({ spec }) => JSON.stringify(spec.env).includes(login))).toBe(false)
    expect(headers).toEqual([
      [`${NESTED} http.${NESTED}.extraHeader`],
      [`${NESTED} http.${NESTED}.extraHeader`],
      [`${NESTED} http.${NESTED}.extraHeader`],
      [`${NESTED} http.${NESTED}.extraHeader`],
      [`${PROJECT} http.${PROJECT}.extraHeader`],
    ])
  })
})
