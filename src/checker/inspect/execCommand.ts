import { spawn } from 'node:child_process'

import { collectOutput } from '#checker/process/collectOutput.ts'

const STDERR_TAIL_BYTES = 2000

/** Limits of one inspect command */
export interface CommandOptions {
  path: string // PATH, the only variable the command gets besides env
  env?: Record<string, string> // fixed variables a command needs, never taken from the environment
  cwd: string
  timeoutMs: number
  maxBytes: number // stdout cap, the command is stopped there
  input?: Buffer // written to stdin
}

/** Outcome of one inspect command */
export interface CommandOutput {
  stdout: Buffer
  stderr: string
  code: number | null
  truncated: boolean // stdout reached maxBytes and the command was stopped
  timedOut: boolean
}

/** Runs a binary without a shell, replaced by a fake in tests */
export type ExecCommand = (
  file: string,
  args: string[],
  options: CommandOptions,
) => Promise<CommandOutput>

/**
 * Runs a binary without a shell, with PATH and the fixed variables of the options as its whole
 * environment. It is killed at the timeout
 * or once stdout reaches the cap; stderr only keeps its tail, so a flood of warnings neither
 * stops the command nor hides its exit code.
 * @param {string} file - Binary name, looked up in PATH
 * @param {string[]} args - Arguments, passed verbatim
 * @param {CommandOptions} options - PATH, directory, timeout, stdout cap and optional stdin
 * @returns {Promise<CommandOutput>} - Output, exit code and whether it was cut or timed out
 */
export const execCommand: ExecCommand = (file, args, options) =>
  new Promise((resolve) => {
    // no own process group: the worker's kill of Claude's group must reach the command too
    const child = spawn(file, args, {
      cwd: options.cwd,
      env: { ...options.env, PATH: options.path },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let timedOut = false

    /**
     * Kills the command.
     * @returns {void}
     */
    const kill = (): void => {
      child.kill('SIGKILL')
    }
    const stdout = collectOutput(child.stdout, options.maxBytes, 'head', kill)
    const stderr = collectOutput(child.stderr, STDERR_TAIL_BYTES, 'tail')
    const timer = setTimeout(() => {
      timedOut = true
      kill()
    }, options.timeoutMs)

    child.once('error', (error) => {
      clearTimeout(timer)
      resolve({
        stdout: Buffer.alloc(0),
        stderr: error.message,
        code: null,
        truncated: false,
        timedOut,
      })
    })
    child.once('close', (code) => {
      clearTimeout(timer)
      resolve({
        stdout: stdout.bytes(),
        stderr: stderr.text(),
        code,
        truncated: stdout.truncated(),
        timedOut: timedOut && !stdout.truncated(),
      })
    })
    child.stdin.on('error', () => undefined)
    child.stdin.end(options.input)
  })
