// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { WorkerClaimImage } from '#core/check.ts'
import { createFakeRunner, toolBehaviour, type Behaviour } from '#checker/__tests__/fakeRunner.ts'
import { fetchCheck } from '#checker/fetcher/fetchCheck.ts'
import {
  COMMIT,
  dumpTree,
  fakeGit,
  fakeSieb,
  fetcherConfig,
  GIT_SECRET,
  REGISTRY_SECRET,
  REPO_URL,
  SECRET_FORMS,
  SIEB_IMAGES,
  type FakeSieb,
} from '#checker/fetcher/__tests__/fetchFixtures.ts'
import type { PulledImage } from '#checker/workspace/resolveImage.ts'

const DIGEST = `sha256:${'a'.repeat(64)}`
const IMAGES: WorkerClaimImage[] = [
  { imageRef: `registry.gitlab.com/acme/app@${DIGEST}`, imageDigest: DIGEST, tag: '1.4' },
]
const LABELLED_CONFIG = JSON.stringify({
  config: {
    Labels: {
      'org.opencontainers.image.source': 'https://GitLab.example.com/acme/app',
      'org.opencontainers.image.revision': COMMIT,
    },
  },
})

describe('fetchCheck', () => {
  let root = ''

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'sieb-fetch-'))
    await mkdir(join(root, 'private'))
    await mkdir(join(root, 'shared'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  /**
   * Prepares the test check with fake tools and a fake sieb.
   * @param {object} options - Tool overrides, sieb and images
   * @param {Record<string, Behaviour>} [options.tools] - Tool behaviours to replace
   * @param {FakeSieb} [options.sieb] - Fake sieb
   * @param {WorkerClaimImage[]} [options.images] - Images the checker names
   * @returns {Promise<object>} - Answer or error, spawned processes, pulled images and paths
   */
  const run = async (
    options: {
      tools?: Record<string, Behaviour>
      sieb?: FakeSieb
      images?: WorkerClaimImage[]
    } = {},
  ) => {
    const config = fetcherConfig(root)
    const sieb = options.sieb ?? fakeSieb()
    const dockerConfigs: string[] = []
    const { runner, spawned } = createFakeRunner(
      toolBehaviour({
        git: fakeGit,
        'crane config': async (proc) => {
          const dir = proc.spec.env.DOCKER_CONFIG ?? ''

          dockerConfigs.push(await readFile(join(dir, 'config.json'), 'utf8'))
          dockerConfigs.push(((await stat(join(dir, 'config.json'))).mode & 0o777).toString(8))
          proc.stdout.write(LABELLED_CONFIG)
          proc.exit(0)
        },
        ...options.tools,
      }),
    )
    let pulled: PulledImage[] = []
    const request = { checkId: 7, images: options.images ?? IMAGES, timeoutMs: 60_000 }
    const outcome = await fetchCheck(
      request,
      new AbortController().signal,
      (images) => {
        pulled = images
      },
      { api: sieb.api, runner, config, log: () => undefined, pollMs: 5 },
    ).then(
      (answer) => ({ answer, error: null }),
      (error: unknown) => ({ answer: null, error: error as Error }),
    )
    const workspace = join(config.sharedDir, 'check-7')

    return { ...outcome, spawned, pulled, sieb, dockerConfigs, config, workspace }
  }

  it('pulls with a private docker config, checks out the source and leaks no credential', async () => {
    const { answer, spawned, dockerConfigs, workspace, config, sieb, pulled } = await run()

    expect(pulled.map(({ digest }) => digest)).toEqual([DIGEST])

    expect(answer?.source).toEqual({
      checked: { repoUrl: REPO_URL, revision: COMMIT, fromLabel: true },
    })
    expect(answer?.images.prepared.map(({ dir }) => dir)).toEqual(['images/1-1.4'])
    expect(sieb.sourceRequests).toEqual([
      {
        imageRef: 'registry.gitlab.com/acme/app',
        sourceLabel: 'https://GitLab.example.com/acme/app',
        revisionLabel: COMMIT,
      },
    ])
    expect(dockerConfigs[0]).toContain(Buffer.from(`robot:${REGISTRY_SECRET}`).toString('base64'))
    expect(dockerConfigs[1]).toBe('600')

    const craneDirs = spawned
      .filter(({ spec }) => spec.command === 'crane')
      .map(({ spec }) => spec.env.DOCKER_CONFIG)

    expect(new Set(craneDirs)).toEqual(new Set([join(config.workdir, 'check-7/docker')]))
    await expect(stat(join(config.workdir, 'check-7/docker'))).rejects.toThrow('ENOENT')

    const shared = await dumpTree(config.sharedDir)
    const argv = JSON.stringify(spawned.map(({ spec }) => [spec.command, spec.args, spec.cwd]))

    for (const secret of SECRET_FORMS) {
      expect(shared).not.toContain(secret)
      expect(argv).not.toContain(secret)
    }

    const withGitLogin = spawned.filter(({ spec }) =>
      JSON.stringify(spec.env).includes(Buffer.from(`deploy:${GIT_SECRET}`).toString('base64')),
    )

    expect(withGitLogin.map(({ spec }) => `${spec.command} ${spec.args[0]}`)).toEqual(['git fetch'])
    expect(
      spawned.find(({ spec }) => spec.command === 'syft')?.spec.env.DOCKER_CONFIG,
    ).toBeUndefined()
    expect(spawned.find(({ spec }) => spec.args[0] === 'fetch')?.spec.args).toEqual([
      'fetch',
      '-q',
      '--depth=1',
      '--no-tags',
      '--no-recurse-submodules',
      REPO_URL,
      COMMIT,
    ])

    const source = join(workspace, 'source')

    expect((await readdir(source)).sort()).toEqual(['Dockerfile', 'src'])
    expect((await readdir(join(source, 'src'))).sort()).toEqual(['docker', 'main.go', 'sub'])
    expect(await readdir(join(source, 'src/sub'))).toEqual([])
    expect(await readFile(join(source, 'src/docker'), 'utf8')).toContain('FROM alpine')
  })

  it('pulls the images sieb names instead of the ones the checker asks for', async () => {
    const other = `sha256:${'e'.repeat(64)}`
    const sieb = fakeSieb({
      access: {
        registries: [],
        images: [
          { imageRef: `registry.gitlab.com/acme/app@${other}`, imageDigest: other, tag: '2.0' },
        ],
      },
    })
    const { answer, spawned } = await run({ sieb })

    expect(answer?.images.prepared.map(({ digest }) => digest)).toEqual([other])
    expect(spawned.some(({ spec }) => spec.args.includes(IMAGES[0]!.imageRef))).toBe(false)
  })

  it('falls back to the default branch when the commit cannot be fetched', async () => {
    const { answer, spawned } = await run({
      tools: {
        git: async (proc) => {
          if (proc.spec.args[0] === 'fetch' && proc.spec.args.includes(COMMIT)) {
            proc.stderr.write('fatal: remote error: upload-pack: not our ref\n')
            proc.exit(128)

            return
          }

          await fakeGit(proc)
        },
      },
    })

    expect(answer?.source).toEqual({
      checked: { repoUrl: REPO_URL, revision: null, fromLabel: true },
    })
    expect(
      spawned.filter(({ spec }) => spec.args[0] === 'fetch').map(({ spec }) => spec.args.at(-1)),
    ).toEqual([COMMIT, 'HEAD'])
  })

  it('stops a fetch that passes the size cap and removes the partial checkout', async () => {
    const { answer, spawned, workspace } = await run({
      tools: {
        git: async (proc) => {
          if (proc.spec.args[0] === 'fetch') {
            await writeFile(join(proc.spec.cwd, '.git/pack'), 'x'.repeat(128 * 1024))

            return
          }

          await fakeGit(proc)
        },
      },
    })

    expect(answer?.source).toEqual({ missing: 'too_large' })
    expect(spawned.find(({ spec }) => spec.args[0] === 'fetch')?.killed).toBe(true)
    expect(await readdir(workspace)).toEqual(['images'])
  })

  it('rejects a checked-out tree above the cap', async () => {
    const { answer, workspace } = await run({
      tools: {
        git: async (proc) => {
          if (proc.spec.args[0] === 'checkout') {
            await writeFile(join(proc.spec.cwd, 'big'), 'x'.repeat(100 * 1024))
          }

          await fakeGit(proc)
        },
      },
    })

    expect(answer?.source).toEqual({ missing: 'too_large' })
    expect(await readdir(workspace)).toEqual(['images'])
  })

  it('reports the skip reason of sieb, a failed clone and an unanswered source request', async () => {
    const skipped = await run({
      sieb: fakeSieb({ source: async () => ({ skip: 'no_credential' }) }),
    })

    expect(skipped.answer?.source).toEqual({ missing: 'no_credential' })
    expect(skipped.spawned.some(({ spec }) => spec.command === 'git')).toBe(false)

    const failed = await run({
      tools: {
        git: async (proc) => {
          proc.stderr.write('fatal: Authentication failed\n')
          proc.exit(proc.spec.args[0] === 'init' ? 0 : 128)
        },
      },
    })

    expect(failed.answer?.source).toEqual({ missing: 'clone_failed' })

    const silent = await run({
      sieb: fakeSieb({
        source: async () => {
          throw new Error('source request failed: sieb answered 500')
        },
      }),
    })

    expect(silent.answer?.source).toEqual({ missing: 'unavailable' })
  })

  it('fails with a redacted reason and removes the docker config when the primary pull fails', async () => {
    const { error, pulled, config } = await run({
      tools: {
        'crane config': (proc) => {
          proc.stderr.write(
            `Error: GET https://registry.gitlab.com/v2/: DENIED for ${REGISTRY_SECRET}\n`,
          )
          proc.exit(1)
        },
      },
    })

    expect(error?.message).toBe(
      'image pull failed: Error: GET https://registry.gitlab.com/v2/: DENIED for [redacted]',
    )
    expect(pulled).toEqual([])
    await expect(stat(join(config.workdir, 'check-7/docker'))).rejects.toThrow('ENOENT')
  })

  it('names the credential whose login the registry refused, never the login', async () => {
    const refuse: Behaviour = (proc) => {
      proc.stderr.write(
        `GET https://registry.gitlab.com/v2/acme/app: UNAUTHORIZED for ${REGISTRY_SECRET}\n`,
      )
      proc.exit(1)
    }
    const login = { host: 'registry.gitlab.com', username: 'robot', secret: REGISTRY_SECRET }
    const labelled = await run({
      tools: { 'crane config': refuse },
      sieb: fakeSieb({
        access: { registries: [{ ...login, label: 'GitLab deploy' }], images: SIEB_IMAGES },
      }),
    })
    const unlabelled = await run({ tools: { 'crane config': refuse } })

    expect(labelled.error?.message).toMatch(
      /^the registry refused the login of credential 'GitLab deploy': image pull failed: .*UNAUTHORIZED/,
    )
    expect(labelled.error?.message).not.toContain(REGISTRY_SECRET)
    expect(unlabelled.error?.message).toMatch(
      /^the registry refused the login of the credential for registry\.gitlab\.com: /,
    )
    expect(labelled.pulled).toEqual([])
  })

  it('removes what an earlier check left in both directories', async () => {
    const config = fetcherConfig(root)

    await mkdir(join(config.sharedDir, 'check-3/source'), { recursive: true })
    await mkdir(join(config.workdir, 'check-3/docker'), { recursive: true })
    await run()

    expect(await readdir(config.sharedDir)).toEqual(['check-7'])
    expect(await readdir(config.workdir)).toEqual(['check-7'])
  })

  it('sends a revision label that is no hex commit id as null', async () => {
    const { sieb } = await run({
      tools: {
        'crane config': (proc) => {
          proc.stdout.write(
            JSON.stringify({ config: { Labels: { 'org.opencontainers.image.revision': 'v1.4' } } }),
          )
          proc.exit(0)
        },
      },
    })

    expect(sieb.sourceRequests[0]).toMatchObject({ sourceLabel: null, revisionLabel: null })
  })
})
