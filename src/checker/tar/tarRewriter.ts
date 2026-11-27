import { classifyEntry, dataSize, type DropReason, type SeenPaths } from '#checker/tar/tarEntry.ts'
import { BLOCK, isZeroBlock, padded, parseHeader, TarFormatError } from '#checker/tar/tarHeader.ts'
import { applyMetaRecord, type HeaderOverrides } from '#checker/tar/tarPax.ts'
import { serializeEntry } from '#checker/tar/tarSerialize.ts'

const META_MAX_BYTES = 1024 * 1024
const META_TYPES = new Set(['x', 'g', 'L', 'K'])
const EMPTY = Buffer.alloc(0)

/** Counts of a rewritten archive */
export interface TarFilterStats {
  entries: number
  dropped: Record<DropReason, number>
}

/** Incremental tar rewriter */
export interface TarRewriter {
  write: (chunk: Buffer) => void
  end: () => void
  stats: TarFilterStats
}

/**
 * Creates a rewriter that parses a tar archive chunk by chunk and writes a fresh archive of the
 * entries that are safe to extract: no absolute or ".." paths, no device files or fifos, nothing
 * below an extracted symlink or a hard link to one, hard links only to extracted files and
 * symlinks, no ignore files, root-owned headers with normalized modes. File data is passed
 * through unchanged.
 * @param {(chunk: Buffer) => void} push - Receives the output
 * @returns {TarRewriter} - Chunk writer, end call and counters
 * @throws {TarFormatError} - From write or end on malformed input
 */
export const createTarRewriter = (push: (chunk: Buffer) => void): TarRewriter => {
  const stats: TarFilterStats = {
    entries: 0,
    dropped: { unsafe_path: 0, special_file: 0, under_symlink: 0, link_target: 0, ignore_file: 0 },
  }
  const seen: SeenPaths = { extracted: new Map(), symlinks: new Set() }
  let buffered: Buffer = EMPTY
  let remaining = 0
  let passData = false
  let meta: { typeflag: string; size: number } | null = null
  let overrides: HeaderOverrides = {}
  let ended = false

  /**
   * Handles one header block: starts a meta record or decides an entry.
   * @param {Buffer} block - Header block
   * @returns {void}
   */
  const onHeader = (block: Buffer): void => {
    const header = parseHeader(block)

    if (META_TYPES.has(header.typeflag)) {
      if (header.size > META_MAX_BYTES) {
        throw new TarFormatError('tar meta record too large')
      }

      meta = { typeflag: header.typeflag, size: header.size }

      return
    }

    const size = dataSize(header, overrides)
    const classified = classifyEntry(header, overrides, seen)

    overrides = {}
    remaining = padded(size)
    passData = 'entry' in classified

    if ('entry' in classified) {
      stats.entries++
      serializeEntry(classified.entry).forEach(push)
    } else if (classified.drop) {
      stats.dropped[classified.drop]++
    }
  }

  /**
   * Consumes as much of the buffered input as possible.
   * @returns {void}
   */
  const drain = (): void => {
    while (!ended) {
      if (remaining > 0) {
        if (buffered.length === 0) {
          return
        }

        const take = Math.min(remaining, buffered.length)

        if (passData) {
          push(buffered.subarray(0, take))
        }

        buffered = buffered.subarray(take)
        remaining -= take
      } else if (meta) {
        const length = padded(meta.size)

        if (buffered.length < length) {
          return
        }

        applyMetaRecord(overrides, meta.typeflag, buffered.subarray(0, meta.size))
        buffered = buffered.subarray(length)
        meta = null
      } else {
        if (buffered.length < BLOCK) {
          return
        }

        const block = buffered.subarray(0, BLOCK)

        buffered = buffered.subarray(BLOCK)

        if (isZeroBlock(block)) {
          push(Buffer.alloc(BLOCK * 2))
          ended = true
        } else {
          onHeader(block)
        }
      }
    }

    buffered = EMPTY
  }

  return {
    write: (chunk) => {
      buffered = buffered.length > 0 ? Buffer.concat([buffered, chunk]) : chunk
      drain()
    },
    end: () => {
      if (ended) {
        return
      }

      if (remaining > 0 || meta || buffered.length > 0) {
        throw new TarFormatError('image export ended mid-entry')
      }

      push(Buffer.alloc(BLOCK * 2))
    },
    stats,
  }
}
