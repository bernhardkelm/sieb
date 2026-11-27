import { spawn } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'

/** File descriptor that carries ProcessSpec.fd3Input to the child */
export const INPUT_FD = 3

/** A command to start, always with an explicit environment */
export interface ProcessSpec {
  command: string
  args: string[]
  cwd: string
  env: Record<string, string>
  stdin: 'pipe' | 'ignore'
  fd3Input?: string // written to a pipe on fd 3 and closed, keeps a secret out of env and argv
}

/** How a process ended */
export interface ProcessExit {
  code: number | null
  signal: string | null
  error: string | null // spawn failure such as a missing binary
}

/** A started process */
export interface RunningProcess {
  stdin: Writable | null
  stdout: Readable
  stderr: Readable
  exited: Promise<ProcessExit>
  kill: () => void
}

/** Starts processes, replaced by a fake in tests */
export interface ProcessRunner {
  spawn: (spec: ProcessSpec) => RunningProcess
}

/**
 * Writes the fd 3 input of a process and closes the pipe, ignoring a child that exited early.
 * @param {Writable | null | undefined} pipe - Parent end of the fd 3 pipe
 * @param {string} input - Data to hand over
 * @returns {void}
 */
const handOver = (pipe: Writable | null | undefined, input: string): void => {
  pipe?.on('error', () => undefined)
  pipe?.end(input)
}

/**
 * Starts a process in its own process group, so killing it also ends everything it started.
 * @param {ProcessSpec} spec - Command, arguments, directory, environment and fd 3 input
 * @returns {RunningProcess} - Streams, exit promise and a kill function for the whole group
 * @throws {Error} - When the output pipes are missing
 */
const spawnInGroup = (spec: ProcessSpec): RunningProcess => {
  const extra = spec.fd3Input === undefined ? [] : ['pipe' as const]
  const child = spawn(spec.command, spec.args, {
    cwd: spec.cwd,
    env: spec.env,
    detached: true,
    stdio: [spec.stdin, 'pipe', 'pipe', ...extra],
  })
  const { stdin, stdout, stderr } = child

  if (!stdout || !stderr) {
    throw new Error(`${spec.command} started without output pipes`)
  }

  if (spec.fd3Input !== undefined) {
    handOver(child.stdio[INPUT_FD] as Writable | null, spec.fd3Input)
  }

  const exited = new Promise<ProcessExit>((resolve) => {
    child.once('error', (error) => resolve({ code: null, signal: null, error: error.message }))
    child.once('close', (code, signal) => resolve({ code, signal, error: null }))
  })

  /**
   * Kills the process group with SIGKILL, ignoring a group that is already gone.
   * @returns {void}
   */
  const kill = (): void => {
    if (child.pid === undefined) {
      return
    }

    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {
      // the group has already exited
    }
  }

  return { stdin, stdout, stderr, exited, kill }
}

/** The runner that starts real processes */
export const processRunner: ProcessRunner = { spawn: spawnInGroup }
