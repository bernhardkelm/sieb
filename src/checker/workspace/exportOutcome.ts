import { errorTail } from '#checker/process/errorTail.ts'
import type { ProcessExit } from '#checker/process/processRunner.ts'
import { ExportTooLargeError } from '#checker/tar/tarFilter.ts'
import { TarFormatError } from '#checker/tar/tarHeader.ts'

/** What an export pipeline ended with */
export interface ExportRun {
  pipeError: unknown // rejection of crane stdout, filter and tar stdin, null on success
  crane: ProcessExit
  tar: ProcessExit
  craneErrors: string // stderr tail
  tarErrors: string
  aborted: boolean
  timedOut: boolean
  maxBytes: number
}

/**
 * Formats a byte count for an error text.
 * @param {number} bytes - Byte count
 * @returns {string} - For example "4 GiB" or "512 MiB"
 */
const formatBytes = (bytes: number): string =>
  bytes >= 1024 ** 3
    ? `${Number((bytes / 1024 ** 3).toFixed(2))} GiB`
    : `${Number((bytes / 1024 ** 2).toFixed(2))} MiB`

/**
 * Returns whether a process failed by itself: a spawn error or a non-zero exit code. A process
 * the worker killed ends with a signal instead.
 * @param {ProcessExit} exit - Exit of the process
 * @returns {boolean} - Whether it failed without being killed
 */
const failedByItself = (exit: ProcessExit): boolean =>
  exit.error !== null || (exit.signal === null && exit.code !== 0)

/**
 * Names the cause of a failed export. Once the pipeline fails the worker kills crane, so crane's
 * exit counts only when crane failed by itself, and not on a broken pipe after tar died.
 * @param {ExportRun} run - Pipeline outcome
 * @returns {string | null} - Short reason, null when the export succeeded
 */
export const exportFailure = (run: ExportRun): string | null => {
  if (run.aborted) {
    return 'image export aborted'
  }

  if (run.timedOut) {
    return 'image export timed out'
  }

  if (run.pipeError instanceof ExportTooLargeError) {
    return `image export exceeds ${formatBytes(run.maxBytes)}`
  }

  const brokenPipe = /broken pipe|EPIPE/i.test(run.craneErrors)

  if (failedByItself(run.crane) && !brokenPipe) {
    return `image pull failed: ${run.crane.error ?? errorTail(run.craneErrors)}`
  }

  if (run.pipeError instanceof TarFormatError) {
    return `image export is not a valid tar stream: ${run.pipeError.message}`
  }

  if (failedByItself(run.tar) || run.pipeError) {
    return `image extraction failed: ${run.tar.error ?? errorTail(run.tarErrors)}`
  }

  if (run.crane.signal !== null) {
    return `image pull failed: crane ended with ${run.crane.signal}`
  }

  return null
}
