import { CheckFailure } from '#checker/CheckFailure.ts'
import type { ProcessRunner } from '#checker/process/processRunner.ts'
import { runCaptured, type CapturedRun } from '#checker/process/runCaptured.ts'
import type { ToolLayout } from '#checker/workspace/checkLayout.ts'

/** Settings of the image tools, shared by the checker and the fetcher */
export interface ToolConfig {
  path: string // PATH handed to the tools
  platform: string
  imageMaxBytes: number // cap on the uncompressed exports of all images of a check
}

/** What the image tools need */
export interface ToolContext {
  runner: ProcessRunner
  config: ToolConfig
  signal: AbortSignal
  remainingMs: () => number // time left until the check deadline
  log: (line: string) => void
}

/**
 * Returns the environment of crane, tar and syft: PATH, the check HOME and TMPDIR, and
 * DOCKER_CONFIG when the layout names one. Registry logins stay in that file, never in the
 * environment.
 * @param {ToolConfig} config - Tool settings
 * @param {ToolLayout} layout - Tool paths
 * @returns {Record<string, string>} - Environment
 */
export const toolEnv = (config: ToolConfig, layout: ToolLayout): Record<string, string> => ({
  PATH: config.path,
  HOME: layout.home,
  TMPDIR: layout.tmp,
  SYFT_CHECK_FOR_APP_UPDATE: 'false',
  ...(layout.dockerConfig === null ? {} : { DOCKER_CONFIG: layout.dockerConfig }),
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
 * @param {ToolLayout} layout - Tool paths
 * @param {ToolContext} context - Runner, config, abort signal and deadline
 * @returns {Promise<CapturedRun>} - The finished run, exit code not yet checked
 * @throws {CheckFailure} - When the run was aborted or timed out
 */
export const runTool = async (
  step: string,
  tool: { command: string; args: string[]; maxStdoutBytes: number },
  layout: ToolLayout,
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
