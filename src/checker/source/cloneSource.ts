import { mkdir } from 'node:fs/promises'

import type { GitAuth } from '#checker/source/gitEnv.ts'
import { gitMiss, runGit, type CloneMiss, type GitContext } from '#checker/source/runGit.ts'

/** What one shallow clone needs */
export interface CloneContext extends Omit<GitContext, 'deadline' | 'limit'> {
  timeoutMs: number // for all git steps together
  maxBytes: number // source size cap
  log: (line: string) => void
}

/** Outcome of a clone */
export type CloneResult = { ok: true; revision: string | null } | CloneMiss

/**
 * Returns the arguments of a depth-1 fetch of one ref, without tags and submodules.
 * @param {string} repoUrl - https URL without credentials
 * @param {string} ref - Full commit id or HEAD
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
 * Checks out one revision of a repository into a new directory over https: git init, a depth-1
 * fetch of the commit, or of the default branch when no commit is known or the server refuses
 * it, and git checkout of the fetched commit. Only the fetch gets the login.
 * @param {string} dir - New clone directory
 * @param {GitAuth} auth - Repository URL and login
 * @param {string | null} commit - Full commit id, null for the default branch
 * @param {CloneContext} context - Runner, git environment, abort signal, time and size limits
 * @returns {Promise<CloneResult>} - Checked-out commit, null for the default branch, or the miss
 * @throws {CheckFailure} - When the check was aborted
 */
export const cloneSource = async (
  dir: string,
  auth: GitAuth,
  commit: string | null,
  context: CloneContext,
): Promise<CloneResult> => {
  const git: GitContext = {
    ...context,
    deadline: Date.now() + context.timeoutMs,
    limit: context.maxBytes,
  }

  await mkdir(dir, { recursive: true })

  const init = gitMiss(
    'git init',
    await runGit(['init', '-q', '--template='], dir, null, git),
    context.signal,
  )

  if (init !== null) {
    return init
  }

  let revision = commit
  let fetched = gitMiss(
    'git fetch',
    await runGit(fetchArgs(auth.repoUrl, commit ?? 'HEAD'), dir, auth, git),
    context.signal,
  )

  if (fetched?.reason === 'clone_failed' && commit !== null) {
    context.log(`[sieb-fetcher] fetching commit ${commit} failed, trying the default branch`)
    revision = null
    fetched = gitMiss(
      'git fetch',
      await runGit(fetchArgs(auth.repoUrl, 'HEAD'), dir, auth, git),
      context.signal,
    )
  }

  if (fetched !== null) {
    return fetched
  }

  // the checkout holds the packed objects and the tree at once
  const checkout = gitMiss(
    'git checkout',
    await runGit(['checkout', '-q', '--detach', 'FETCH_HEAD'], dir, null, {
      ...git,
      limit: 2 * context.maxBytes,
    }),
    context.signal,
  )

  return checkout ?? { ok: true, revision }
}
