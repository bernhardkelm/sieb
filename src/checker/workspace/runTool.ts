import { CheckFailure } from '#checker/CheckFailure.ts'
import type { CheckerConfig } from '#checker/checkerConfig.ts'
import type { ProcessRunner } from '#checker/process/processRunner.ts'
import { runCaptured, type CapturedRun } from '#checker/process/runCaptured.ts'
import type { CheckLayout } from '#checker/workspace/checkLayout.ts'

/** What the image tools need */
export interface ToolContext {
  runner: ProcessRunner
  config: CheckerConfig
  signal: AbortSignal
  remainingMs: () => number // time left until the check deadline
  log: (line: string) => void
}

/**
 * Returns the environment of crane, tar and syft: PATH, the check HOME and TMPDIR, no secrets.
 * @param {CheckerConfig} config - Worker configuration
 * @param {CheckLayout} layout - Check paths
 * @returns {Record<string, string>} - Environment
 */
export const toolEnv = (config: CheckerConfig, layout: CheckLayout): Record<string, string> => ({
  PATH: config.path,
  HOME: layout.home,
  TMPDIR: layout.tmp,
  SYFT_CHECK_FOR_APP_UPDATE: 'false',
})

/**
 * Throws when a captured tool run was aborted or timed out.
 * @param {CapturedRun} run - Captured run
 * @param {string} step - Step name for the error text
 * @returns {void}
 * @throws {CheckFailure} - When the run did not finish by itself
 */
export const ensureFinished = (run: CapturedRun, step: string): void => {
  if (run.aborted) {
    throw new CheckFailure(`${step} aborted`)
  }

  if (run.timedOut) {
    throw new CheckFailure(`${step} timed out`)
  }
}

/**
 * Runs an image tool in the workspace with the tool environment until the check deadline.
 * @param {string} step - Step name for the error text
 * @param {{ command: string, args: string[], maxStdoutBytes: number }} tool - Command, arguments and stdout cap
 * @param {CheckLayout} layout - Check paths
 * @param {ToolContext} context - Runner, config, abort signal and deadline
 * @returns {Promise<CapturedRun>} - The finished run, exit code not yet checked
 * @throws {CheckFailure} - When the run was aborted or timed out
 */
export const runTool = async (
  step: string,
  tool: { command: string; args: string[]; maxStdoutBytes: number },
  layout: CheckLayout,
  context: ToolContext,
): Promise<CapturedRun> => {
  const run = await runCaptured(
    context.runner,
    {
      command: tool.command,
      args: tool.args,
      cwd: layout.workspace,
      env: toolEnv(context.config, layout),
      stdin: 'ignore',
    },
    {
      signal: context.signal,
      timeoutMs: context.remainingMs(),
      maxStdoutBytes: tool.maxStdoutBytes,
    },
  )

  ensureFinished(run, step)

  return run
}
