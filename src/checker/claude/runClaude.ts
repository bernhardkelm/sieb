import type { WorkerClaim, WorkerResult } from '#core/check.ts'
import type { CheckerConfig } from '#checker/checkerConfig.ts'
import { CheckFailure } from '#checker/CheckFailure.ts'
import { claudeArgs, claudeEnv } from '#checker/claude/claudeInvocation.ts'
import { claudeResult } from '#checker/claude/claudeOutput.ts'
import { workspacePrompt } from '#checker/claude/workspacePrompt.ts'
import type { ProcessRunner } from '#checker/process/processRunner.ts'
import { runCaptured } from '#checker/process/runCaptured.ts'
import type { CheckLayout } from '#checker/workspace/checkLayout.ts'
import type { WorkspaceImages } from '#checker/workspace/prepareWorkspace.ts'

const STDOUT_MAX_BYTES = 8 * 1024 * 1024

/** What one Claude run needs */
export interface ClaudeRunContext {
  runner: ProcessRunner
  config: CheckerConfig
  signal: AbortSignal
  timeoutMs: number
}

/**
 * Runs headless Claude Code in the check workspace and maps its output to result parts. The
 * credential reaches Claude on file descriptor 3.
 * @param {WorkerClaim} claim - Claimed check
 * @param {WorkspaceImages} images - Prepared and skipped images, named in the prompt
 * @param {CheckLayout} layout - Prepared check paths
 * @param {ClaudeRunContext} context - Runner, config, abort signal and time left
 * @returns {Promise<Omit<WorkerResult, 'durationMs'>>} - Status, error, usage and reply
 * @throws {CheckFailure} - When the run was aborted
 */
export const runClaude = async (
  claim: WorkerClaim,
  images: WorkspaceImages,
  layout: CheckLayout,
  context: ClaudeRunContext,
): Promise<Omit<WorkerResult, 'durationMs'>> => {
  const { config } = context
  const prompt = workspacePrompt(claim, config.platform, images)
  const run = await runCaptured(
    context.runner,
    {
      command: 'claude',
      args: claudeArgs(
        prompt,
        layout,
        claim.maxTurns,
        config.webDomains,
        config.model,
        config.effort,
      ),
      cwd: layout.workspace,
      env: claudeEnv(config.credential.kind, config.path, layout),
      stdin: 'ignore',
      fd3Input: config.credential.value,
    },
    { signal: context.signal, timeoutMs: context.timeoutMs, maxStdoutBytes: STDOUT_MAX_BYTES },
  )

  if (run.aborted) {
    throw new CheckFailure('Claude aborted')
  }

  return claudeResult(run, claim.timeoutSeconds)
}
