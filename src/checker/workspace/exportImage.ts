import { pipeline } from 'node:stream/promises'

import { CheckFailure } from '#checker/CheckFailure.ts'
import { collectOutput } from '#checker/process/collectOutput.ts'
import type { ProcessRunner } from '#checker/process/processRunner.ts'
import { watchProcess } from '#checker/process/watchProcess.ts'
import { createTarFilter, ExportTooLargeError } from '#checker/tar/tarFilter.ts'
import type { TarFilterStats } from '#checker/tar/tarRewriter.ts'
import { exportFailure } from '#checker/workspace/exportOutcome.ts'

const ERROR_TAIL_BYTES = 4096

/** An export that passed its byte cap, the worker skips an extra image for it */
export class ImageTooLargeFailure extends CheckFailure {
  /**
   * Creates the failure with the short reason of the export.
   * @param {string} message - Short reason
   * @returns {void}
   */
  constructor(message: string) {
    super(message)
    this.name = 'ImageTooLargeFailure'
  }
}

/** Entry counts of an export and the uncompressed bytes it read */
export interface ExportStats extends TarFilterStats {
  bytes: number
}

/** Inputs of one image export */
export interface ExportOptions {
  runner: ProcessRunner
  imageRef: string
  platform: string
  imageDir: string
  maxBytes: number
  env: Record<string, string>
  signal: AbortSignal
  timeoutMs: number
}

/**
 * Streams the flattened filesystem of an image into a directory: crane export, through the tar
 * filter with its byte cap, into tar -x without owners and permissions from the archive.
 * @param {ExportOptions} options - Image, platform, target directory, cap and abort handling
 * @returns {Promise<ExportStats>} - Extracted and dropped entry counts and the bytes read
 * @throws {CheckFailure} - When the export is too large, the pull fails or extraction fails
 */
export const exportImage = async (options: ExportOptions): Promise<ExportStats> => {
  const { runner, env, imageDir } = options
  const crane = runner.spawn({
    command: 'crane',
    args: ['export', '--platform', options.platform, options.imageRef, '-'],
    cwd: imageDir,
    env,
    stdin: 'ignore',
  })
  const tar = runner.spawn({
    command: 'tar',
    args: ['-x', '-f', '-', '-C', imageDir, '--no-same-owner', '--no-same-permissions'],
    cwd: imageDir,
    env,
    stdin: 'pipe',
  })
  const craneErrors = collectOutput(crane.stderr, ERROR_TAIL_BYTES, 'tail')
  const tarErrors = collectOutput(tar.stderr, ERROR_TAIL_BYTES, 'tail')
  const filter = createTarFilter(options.maxBytes)
  const watches = [crane, tar].map((child) =>
    watchProcess(child, options.signal, options.timeoutMs),
  )

  tar.stdout.resume()
  const piped = pipeline(crane.stdout, filter.stream, tar.stdin!).then(
    () => null,
    (error: unknown) => {
      crane.kill()
      tar.kill()

      return error
    },
  )
  const [pipeError, craneExit, tarExit] = await Promise.all([piped, crane.exited, tar.exited])

  watches.forEach((watch) => watch.release())

  const aborted = watches.some((watch) => watch.aborted())
  const timedOut = watches.some((watch) => watch.timedOut())
  const failure = exportFailure({
    pipeError,
    crane: craneExit,
    tar: tarExit,
    craneErrors: craneErrors.text(),
    tarErrors: tarErrors.text(),
    aborted,
    timedOut,
    maxBytes: options.maxBytes,
  })

  if (failure !== null) {
    const tooLarge = !aborted && !timedOut && pipeError instanceof ExportTooLargeError

    throw tooLarge ? new ImageTooLargeFailure(failure) : new CheckFailure(failure)
  }

  return { ...filter.stats, bytes: filter.bytes() }
}
