import { Transform } from 'node:stream'

import { createTarRewriter, type TarFilterStats } from '#checker/tar/tarRewriter.ts'

/** The input passed the byte cap */
export class ExportTooLargeError extends Error {
  /**
   * Creates the error for the given cap.
   * @param {number} maxBytes - Cap in bytes
   * @returns {void}
   */
  constructor(maxBytes: number) {
    super(`image export exceeds ${maxBytes} bytes`)
    this.name = 'ExportTooLargeError'
  }
}

/** The filter stream with its counters */
export interface TarFilter {
  stream: Transform
  stats: TarFilterStats
}

/**
 * Creates a stream that enforces a byte cap on a tar archive and rewrites it for safe extraction.
 * @param {number} maxBytes - Largest accepted input size
 * @returns {TarFilter} - Transform stream and its counters
 */
export const createTarFilter = (maxBytes: number): TarFilter => {
  let total = 0
  const stream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      total += chunk.length
      if (total > maxBytes) {
        callback(new ExportTooLargeError(maxBytes))

        return
      }

      try {
        rewriter.write(chunk)
        callback()
      } catch (error) {
        callback(error as Error)
      }
    },
    flush(callback) {
      try {
        rewriter.end()
        callback()
      } catch (error) {
        callback(error as Error)
      }
    },
  })

  const rewriter = createTarRewriter((chunk) => stream.push(chunk))

  return { stream, stats: rewriter.stats }
}
