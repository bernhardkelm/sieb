import { CheckFailure } from '#checker/CheckFailure.ts'
import { errorTail } from '#checker/process/errorTail.ts'
import type { ProcessRunner } from '#checker/process/processRunner.ts'
import { runCaptured, type CapturedRun } from '#checker/process/runCaptured.ts'
import { dirBytes } from '#checker/source/dirBytes.ts'
import { gitEnv, type GitAuth, type GitBase } from '#checker/source/gitEnv.ts'

const OUTPUT_MAX_BYTES = 64 * 1024

/** What the git steps of one clone need */
export interface GitContext {
  runner: ProcessRunner
  base: GitBase // PATH, HOME and TMPDIR of git
  signal: AbortSignal
  deadline: number // Date.now() value all git steps together must finish by
  limit: number // size the clone directory may reach during the step
  pollMs: number // interval of the size watch
}

/** Outcome of a clone that checked out nothing */
export interface CloneMiss {
  ok: false
  reason: 'clone_failed' | 'too_large'
  detail: string // short reason for the log, may still hold untrusted server text
}

/** One finished git step */
export interface GitStep {
  run: CapturedRun
  tooLarge: boolean // the directory passed the step's limit and git was stopped
}

/**
 * Runs one git step in the clone directory while a watch stops it once the directory passes the
 * size limit, so a huge repository cannot fill the shared volume.
 * @param {string[]} args - git arguments
 * @param {string} dir - Clone directory
 * @param {GitAuth | null} auth - Login, only for the fetch
 * @param {GitContext} context - Runner, base environment, abort signal, deadline and size limit
 * @returns {Promise<GitStep>} - The run and whether the size watch stopped it
 */
export const runGit = async (
  args: string[],
  dir: string,
  auth: GitAuth | null,
  context: GitContext,
): Promise<GitStep> => {
  const size = new AbortController()
  let measuring = false
  const watch = setInterval(() => {
    if (measuring) {
      return
    }

    measuring = true
    void dirBytes(dir, context.limit).then((bytes) => {
      measuring = false
      if (bytes > context.limit) {
        size.abort()
      }
    })
  }, context.pollMs)

  try {
    const run = await runCaptured(
      context.runner,
      { command: 'git', args, cwd: dir, env: gitEnv(context.base, auth), stdin: 'ignore' },
      {
        signal: AbortSignal.any([context.signal, size.signal]),
        timeoutMs: context.deadline - Date.now(),
        maxStdoutBytes: OUTPUT_MAX_BYTES,
      },
    )

    return { run, tooLarge: size.signal.aborted }
  } finally {
    clearInterval(watch)
  }
}

/**
 * Maps a finished git step to a clone miss.
 * @param {string} name - Step name for the detail
 * @param {GitStep} step - Finished step
 * @param {AbortSignal} signal - Abort signal of the check
 * @returns {CloneMiss | null} - Miss, null when the step succeeded
 * @throws {CheckFailure} - When the check was aborted
 */
export const gitMiss = (name: string, step: GitStep, signal: AbortSignal): CloneMiss | null => {
  const { run, tooLarge } = step

  if (signal.aborted) {
    throw new CheckFailure('source checkout aborted')
  }

  if (tooLarge) {
    return { ok: false, reason: 'too_large', detail: `${name} passed the size cap` }
  }

  if (run.timedOut) {
    return { ok: false, reason: 'clone_failed', detail: `${name} timed out` }
  }

  if (run.exit.code !== 0) {
    const detail = run.exit.error ?? errorTail(run.stderr)

    return { ok: false, reason: 'clone_failed', detail: `${name}: ${detail}` }
  }

  return null
}
