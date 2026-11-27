import { mkdir, readdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { WorkerClaimImage } from '#core/check.ts'
import type { FetchAccess, SourceAnswer, SourceRequest } from '#core/privateAccess.ts'
import type { Behaviour } from '#checker/__tests__/fakeRunner.ts'
import type { FetcherApi } from '#checker/fetcher/fetcherApi.ts'
import type { FetcherConfig } from '#checker/fetcher/fetcherConfig.ts'

export const REGISTRY_SECRET = 'registry-secret-value-1234'
export const GIT_SECRET = 'git-secret-value-5678'
export const COMMIT = 'c'.repeat(40)
/** Commit the fake git reports for a fetched tag or branch */
export const HEAD_COMMIT = 'b'.repeat(40)
export const REPO_URL = 'https://gitlab.example.com/acme/app.git'
export const LOCAL_SECRET = 'l'.repeat(32)
const DIGEST = `sha256:${'a'.repeat(64)}`
/** The images sieb names in its access answer by default */
export const SIEB_IMAGES: WorkerClaimImage[] = [
  { imageRef: `registry.gitlab.com/acme/app@${DIGEST}`, imageDigest: DIGEST, tag: '1.4' },
]

/** Every form a test credential could leak in */
export const SECRET_FORMS = [
  REGISTRY_SECRET,
  GIT_SECRET,
  Buffer.from(`robot:${REGISTRY_SECRET}`).toString('base64'),
  Buffer.from(`deploy:${GIT_SECRET}`).toString('base64'),
]

/**
 * Returns a fetcher configuration for tests.
 * @param {string} root - Temporary directory holding the private and the shared directory
 * @returns {FetcherConfig} - Configuration with recognizable secrets
 */
export const fetcherConfig = (root: string): FetcherConfig => ({
  workerUrl: 'http://sieb:3101',
  fetcherSecret: 'fetcher-secret-value',
  localSecret: LOCAL_SECRET,
  port: 0,
  workdir: join(root, 'private'),
  sharedDir: join(root, 'shared'),
  path: '/usr/bin:/bin',
  platform: 'linux/amd64',
  imageMaxBytes: 1024 * 1024,
  sourceMaxBytes: 64 * 1024,
})

/** A fake sieb with recorded source requests */
export interface FakeSieb {
  api: FetcherApi
  sourceRequests: SourceRequest[]
}

/**
 * Creates a fake sieb that grants a registry login and the source by default.
 * @param {object} options - Answers to replace
 * @param {FetchAccess} [options.access] - Access answer
 * @param {() => Promise<SourceAnswer>} [options.source] - Source answer
 * @returns {FakeSieb} - API and recorded requests
 */
export const fakeSieb = (
  options: { access?: FetchAccess; source?: () => Promise<SourceAnswer> } = {},
): FakeSieb => {
  const sourceRequests: SourceRequest[] = []

  return {
    sourceRequests,
    api: {
      access: async () =>
        options.access ?? {
          registries: [{ host: 'registry.gitlab.com', username: 'robot', secret: REGISTRY_SECRET }],
          images: SIEB_IMAGES,
        },
      source: async (_checkId, body) => {
        sourceRequests.push(body)

        return options.source
          ? options.source()
          : {
              grant: {
                repoUrls: [REPO_URL],
                revision: COMMIT,
                username: 'deploy',
                secret: GIT_SECRET,
              },
            }
      },
    },
  }
}

/**
 * Acts like git: init creates .git, fetch writes a pack and remembers its ref, checkout writes a
 * small tree with ignore files and symlinks, rev-parse names the fetched commit, else HEAD_COMMIT.
 * @param {FakeProcess} proc - Fake git process
 * @returns {Promise<void>}
 */
export const fakeGit: Behaviour = async (proc) => {
  const { args, cwd } = proc.spec

  if (args[0] === 'init') {
    await mkdir(join(cwd, '.git'), { recursive: true })
  } else if (args[0] === 'fetch') {
    await writeFile(join(cwd, '.git/pack'), 'p'.repeat(1024))
    await writeFile(join(cwd, '.git/fetched'), args.at(-1) ?? '')
  } else if (args[0] === 'rev-parse') {
    const fetched = await readFile(join(cwd, '.git/fetched'), 'utf8')

    proc.stdout.write(`${/^[0-9a-f]{40}$/u.test(fetched) ? fetched : HEAD_COMMIT}\n`)
  } else if (args[0] === 'checkout') {
    await mkdir(join(cwd, 'src/sub'), { recursive: true })
    await writeFile(join(cwd, 'Dockerfile'), 'FROM alpine:3.21\n')
    await writeFile(join(cwd, 'src/main.go'), 'package main\n')
    await writeFile(join(cwd, '.gitignore'), 'vendor/\n')
    await writeFile(join(cwd, 'src/sub/.rgignore'), '*\n')
    await symlink('/etc/passwd', join(cwd, 'src/escape'))
    await symlink('../Dockerfile', join(cwd, 'src/docker'))
  }

  proc.exit(0)
}

/**
 * Lists every file below a directory with its content.
 * @param {string} root - Directory
 * @returns {Promise<string>} - Paths and contents, one blob for leak scans
 */
export const dumpTree = async (root: string): Promise<string> => {
  const parts: string[] = []

  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    const path = join(entry.parentPath, entry.name)

    parts.push(path)
    if (entry.isFile()) {
      parts.push(await readFile(path, 'utf8'))
    }
  }

  return parts.join('\n')
}
