import type { Readable } from 'node:stream'

/** Collected output of a stream */
export interface CollectedOutput {
  text: () => string
  bytes: () => Buffer
  truncated: () => boolean // more bytes arrived than were kept
}

/**
 * Collects a stream, keeping the head or the tail up to a byte limit.
 * @param {Readable} stream - Stream to read
 * @param {number} limit - Bytes to keep
 * @param {'head' | 'tail'} keep - Which end of the output to keep
 * @param {() => void} onLimit - Called once when the head limit is passed
 * @returns {CollectedOutput} - Accessors for the kept output
 */
export const collectOutput = (
  stream: Readable,
  limit: number,
  keep: 'head' | 'tail',
  onLimit?: () => void,
): CollectedOutput => {
  let kept = Buffer.alloc(0)
  let truncated = false

  stream.on('data', (chunk: Buffer) => {
    if (keep === 'tail') {
      const joined = Buffer.concat([kept, chunk])

      truncated ||= joined.length > limit
      kept = joined.subarray(-limit)

      return
    }

    if (kept.length + chunk.length > limit) {
      kept = Buffer.concat([kept, chunk.subarray(0, Math.max(limit - kept.length, 0))])
      if (!truncated) {
        truncated = true
        onLimit?.()
      }

      return
    }

    kept = Buffer.concat([kept, chunk])
  })

  return { text: () => kept.toString('utf8'), bytes: () => kept, truncated: () => truncated }
}
