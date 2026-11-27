import type { CheckedRefKind } from '#core/privateAccess.ts'
import type { CloneRef } from '#checker/source/cloneRefs.ts'
import { cloneRepository } from '#checker/source/cloneRepository.ts'
import type { CloneMiss, GitContext } from '#checker/source/runGit.ts'

/** What one shallow clone needs */
export interface CloneContext extends Omit<GitContext, 'deadline' | 'limit'> {
  timeoutMs: number // for all candidates and git steps together
  maxBytes: number // source size cap
  log: (line: string) => void
}

/** Candidate repositories and the login of a grant, both login parts null for anonymous */
export interface CloneGrant {
  repoUrls: readonly string[]
  username: string | null
  secret: string | null
}

/** Outcome of a clone */
export type CloneResult =
  | { ok: true; repoUrl: string; kind: CheckedRefKind; ref: string | null; revision: string | null }
  | CloneMiss

/**
 * Checks out the first candidate repository that clones, each tried with every ref in order in a
 * fresh directory. A checkout over the size cap stops at once; the time limit covers all
 * candidates together.
 * @param {string} dir - Clone directory
 * @param {CloneGrant} grant - Candidate URLs in order and the login
 * @param {readonly CloneRef[]} refs - Refs to try per candidate
 * @param {CloneContext} context - Runner, git environment, abort signal, time and size limits
 * @returns {Promise<CloneResult>} - Repository, ref and commit checked out, or the last miss
 * @throws {CheckFailure} - When the check was aborted
 */
export const cloneSource = async (
  dir: string,
  grant: CloneGrant,
  refs: readonly CloneRef[],
  context: CloneContext,
): Promise<CloneResult> => {
  const git = {
    ...context,
    deadline: Date.now() + context.timeoutMs,
    limit: context.maxBytes,
  }
  let miss: CloneMiss = { ok: false, reason: 'clone_failed', detail: 'no repository to clone' }

  for (const [index, repoUrl] of grant.repoUrls.entries()) {
    const { username, secret } = grant
    const result = await cloneRepository(dir, { repoUrl, username, secret }, refs, git)

    if (result.ok) {
      return { ...result, repoUrl }
    }

    if (result.reason === 'too_large') {
      return result
    }

    if (index + 1 < grant.repoUrls.length) {
      context.log(`[sieb-fetcher] no clone of ${repoUrl}: ${result.detail}, trying the next one`)
    }

    miss = result
  }

  return miss
}
