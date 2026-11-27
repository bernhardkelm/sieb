import { Readable, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { createTarFilter } from '#checker/tar/tarFilter.ts'
import { BLOCK, isZeroBlock, padded, parseHeader } from '#checker/tar/tarHeader.ts'
import { paxBody, parsePaxRecords, readLongName } from '#checker/tar/tarPax.ts'
import type { TarFilterStats } from '#checker/tar/tarRewriter.ts'
import { buildHeader } from '#checker/tar/tarSerialize.ts'

/** One entry of a test archive */
export interface FixtureEntry {
  name: string
  type?: string
  linkname?: string
  mode?: number
  data?: string
  pax?: [string, string][]
  longName?: string
}

/** One entry read back from an archive */
export interface ReadEntry {
  name: string
  type: string
  linkname: string
  mode: number
  data: string
}

/**
 * Pads a payload to whole blocks.
 * @param {Buffer} data - Payload
 * @returns {Buffer} - Padded payload
 */
const pad = (data: Buffer): Buffer =>
  Buffer.concat([data, Buffer.alloc(padded(data.length) - data.length)])

/**
 * Builds a tar archive from fixture entries.
 * @param {FixtureEntry[]} entries - Entries in order
 * @param {boolean} end - Whether to append the end-of-archive marker
 * @returns {Buffer} - Archive
 */
export const tarArchive = (entries: FixtureEntry[], end = true): Buffer => {
  const blocks: Buffer[] = []
  const meta = { linkname: '', mode: 0o644, mtime: 0 }

  for (const entry of entries) {
    if (entry.pax) {
      const body = paxBody(entry.pax)

      blocks.push(
        buildHeader({ ...meta, name: 'pax', size: body.length, typeflag: 'x' }),
        pad(body),
      )
    }

    if (entry.longName) {
      const body = Buffer.from(`${entry.longName}\0`)

      blocks.push(buildHeader({ ...meta, name: '././@LongLink', size: body.length, typeflag: 'L' }))
      blocks.push(pad(body))
    }

    const data = Buffer.from(entry.data ?? '')

    blocks.push(
      buildHeader({
        name: entry.name,
        linkname: entry.linkname ?? '',
        mode: entry.mode ?? 0o644,
        size: data.length,
        mtime: 0,
        typeflag: entry.type ?? '0',
      }),
      pad(data),
    )
  }

  return Buffer.concat(end ? [...blocks, Buffer.alloc(BLOCK * 2)] : blocks)
}

/**
 * Reads the entries of an archive the filter wrote, applying pax path records.
 * @param {Buffer} archive - Filter output
 * @returns {ReadEntry[]} - Entries in order
 */
export const readArchive = (archive: Buffer): ReadEntry[] => {
  const entries: ReadEntry[] = []
  let records = new Map<string, string>()

  for (let offset = 0; offset + BLOCK <= archive.length;) {
    const block = archive.subarray(offset, offset + BLOCK)

    if (isZeroBlock(block)) {
      break
    }

    const header = parseHeader(block)
    const data = archive.subarray(offset + BLOCK, offset + BLOCK + header.size)

    offset += BLOCK + padded(header.size)
    if (header.typeflag === 'x') {
      records = parsePaxRecords(data)
      continue
    }

    entries.push({
      name: records.get('path') ?? header.name,
      type: header.typeflag,
      linkname: records.get('linkpath') ?? header.linkname,
      mode: header.mode,
      data: header.typeflag === 'L' ? readLongName(data) : data.toString('utf8'),
    })
    records = new Map()
  }

  return entries
}

/**
 * Runs an archive through the tar filter in small chunks.
 * @param {Buffer} input - Archive
 * @param {number} maxBytes - Byte cap
 * @returns {Promise<{ output: Buffer, stats: TarFilterStats }>} - Filter output and counters
 */
export const filterArchive = async (
  input: Buffer,
  maxBytes = 1024 * 1024,
): Promise<{ output: Buffer; stats: TarFilterStats }> => {
  const chunks: Buffer[] = []
  const pieces = Array.from({ length: Math.ceil(input.length / 300) }, (_, index) =>
    input.subarray(index * 300, (index + 1) * 300),
  )
  const filter = createTarFilter(maxBytes)
  const sink = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk)
      callback()
    },
  })

  await pipeline(Readable.from(pieces), filter.stream, sink)

  return { output: Buffer.concat(chunks), stats: filter.stats }
}
