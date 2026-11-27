import { mkdir, rm } from 'node:fs/promises'

import type { CheckedRefKind } from '#core/privateAccess.ts'
import { refLabel, type CloneRef } from '#checker/source/cloneRefs.ts'
import type { GitAuth } from '#checker/source/gitEnv.ts'
import { gitMiss, runGit, type CloneMiss, type GitContext } from '#checker/source/runGit.ts'
import { isCommit } from '#checker/source/sourceValues.ts'

/** A checkout of one repository */
export interface CheckedOut {
  ok: true
  kind: CheckedRefKind
  ref: string | null
  revision: string | null // commit git reports for HEAD, null when it named none
}

/**
 * Returns the arguments of a depth-1 fetch of one ref, without tags and submodules.
 * @param {string} repoUrl - https URL without credentials
 * @param {string} ref - Full commit id, refs/tags/<name> or HEAD
 * @returns {string[]} - git arguments
 */
const fetchArgs = (repoUrl: string, ref: string): string[] => [
  'fetch',
  '-q',
  '--depth=1',
  '--no-tags',
  '--no-recurse-submodules',
  repoUrl,
  ref,
]

/**
 * Reads the commit of the checkout with a local git rev-parse.
 * @param {string} dir - Clone directory
 * @param {GitContext} git - Git context
 * @returns {Promise<string | null>} - Lower-case commit id, null when git names none
 * @throws {CheckFailure} - When the check was aborted
 */
const headCommit = async (dir: string, git: GitContext): Promise<string | null> => {
  const step = await runGit(['rev-parse', 'HEAD'], dir, null, git)
  const value = step.run.stdout.trim().toLowerCase()

  return gitMiss('git rev-parse', step, git.signal) === null && isCommit(value) ? value : null
}

/**
 * Checks out one repository into a fresh directory over https: git init, a depth-1 fetch of the
 * first ref the server gives, then git checkout of the fetched commit. A failed fetch tries the
 * next ref; only the fetch gets the login.
 * @param {string} dir - Clone directory, emptied first
 * @param {GitAuth} auth - Repository URL and login, both login parts null for an anonymous fetch
 * @param {readonly CloneRef[]} refs - Refs to try in order
 * @param {GitContext & { maxBytes: number; log: (line: string) => void }} git - Git context, size cap and log
 * @returns {Promise<CheckedOut | CloneMiss>} - Checked-out ref and commit, or the miss
 * @throws {CheckFailure} - When the check was aborted
 */
export const cloneRepository = async (
  dir: string,
  auth: GitAuth,
  refs: readonly CloneRef[],
  git: GitContext & { maxBytes: number; log: (line: string) => void },
): Promise<CheckedOut | CloneMiss> => {
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })

  const init = gitMiss(
    'git init',
    await runGit(['init', '-q', '--template='], dir, null, git),
    git.signal,
  )

  if (init !== null) {
    return init
  }

  let miss: CloneMiss = { ok: false, reason: 'clone_failed', detail: 'no ref to fetch' }

  for (const [index, ref] of refs.entries()) {
    const fetched = gitMiss(
      'git fetch',
      await runGit(fetchArgs(auth.repoUrl, ref.fetch), dir, auth, git),
      git.signal,
    )

    if (fetched === null) {
      // the checkout holds the packed objects and the tree at once
      const checkout = gitMiss(
        'git checkout',
        await runGit(['checkout', '-q', '--detach', 'FETCH_HEAD'], dir, null, {
          ...git,
          limit: 2 * git.maxBytes,
        }),
        git.signal,
      )

      return (
        checkout ?? { ok: true, kind: ref.kind, ref: ref.ref, revision: await headCommit(dir, git) }
      )
    }

    if (fetched.reason !== 'clone_failed') {
      return fetched
    }

    const next = refs[index + 1]

    if (next !== undefined) {
      git.log(`[sieb-fetcher] fetching ${refLabel(ref)} failed, trying ${refLabel(next)}`)
    }

    miss = fetched
  }

  return miss
}
