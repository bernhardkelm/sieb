import { collectOutput } from '#checker/process/collectOutput.ts'
import type { ProcessExit, ProcessRunner, ProcessSpec } from '#checker/process/processRunner.ts'
import { watchProcess } from '#checker/process/watchProcess.ts'

const STDERR_TAIL_BYTES = 16 * 1024

/** Limits of one captured run */
export interface CaptureOptions {
  signal: AbortSignal
  timeoutMs: number
  maxStdoutBytes: number
}

/** Outcome of a captured run */
export interface CapturedRun {
  exit: ProcessExit
  stdout: string
  stdoutTruncated: boolean // stdout passed maxStdoutBytes, only its head was kept
  stderr: string // the last 16 KiB
  timedOut: boolean
  aborted: boolean
}

/**
 * Runs a process to completion and captures its output, killing it on abort or timeout.
 * @param {ProcessRunner} runner - Process runner
 * @param {ProcessSpec} spec - Command to run
 * @param {CaptureOptions} options - Abort signal, timeout and stdout limit
 * @returns {Promise<CapturedRun>} - Exit, captured output and whether it was killed or cut
 */
export const runCaptured = async (
  runner: ProcessRunner,
  spec: ProcessSpec,
  options: CaptureOptions,
): Promise<CapturedRun> => {
  const child = runner.spawn(spec)
  const stdout = collectOutput(child.stdout, options.maxStdoutBytes, 'head')
  const stderr = collectOutput(child.stderr, STDERR_TAIL_BYTES, 'tail')
  const watch = watchProcess(child, options.signal, options.timeoutMs)

  child.stdin?.end()
  const exit = await child.exited

  watch.release()

  return {
    exit,
    stdout: stdout.text(),
    stdoutTruncated: stdout.truncated(),
    stderr: stderr.text(),
    timedOut: watch.timedOut(),
    aborted: watch.aborted(),
  }
}
