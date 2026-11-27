import type { EntryKind, TarEntry } from '#checker/tar/tarEntry.ts'
import { BLOCK, checksumOf, padded, type RawHeader } from '#checker/tar/tarHeader.ts'
import { paxBody } from '#checker/tar/tarPax.ts'

const MAX_OCTAL_SIZE = 0o77777777777
const PAX_NAME = 'PaxHeader'
const TYPEFLAGS: Record<EntryKind, string> = {
  file: '0',
  hardlink: '1',
  symlink: '2',
  directory: '5',
}

/** Fields of a header the rewriter writes, the same the parser reads */
export type HeaderFields = RawHeader

/**
 * Writes an octal field padded with zeros and terminated by NUL.
 * @param {Buffer} block - Header block
 * @param {number} offset - Field offset
 * @param {number} length - Field length
 * @param {number} value - Value
 * @returns {void}
 */
const writeOctal = (block: Buffer, offset: number, length: number, value: number): void => {
  block.write(`${value.toString(8).padStart(length - 1, '0')}\0`, offset, length, 'latin1')
}

/**
 * Returns whether a value fits a header string field.
 * @param {string} value - Field text
 * @param {number} length - Field length
 * @returns {boolean} - Whether the UTF-8 bytes fit with a terminating NUL
 */
export const fitsField = (value: string, length: number): boolean =>
  Buffer.byteLength(value) < length

/**
 * Returns whether a size fits the octal size field.
 * @param {number} size - Payload size in bytes
 * @returns {boolean} - Whether no pax size record is needed
 */
export const fitsSize = (size: number): boolean => size <= MAX_OCTAL_SIZE

/**
 * Builds a fresh ustar header owned by root.
 * @param {HeaderFields} fields - Header fields, names that do not fit must be shortened beforehand
 * @returns {Buffer} - Header block with a valid checksum
 */
export const buildHeader = (fields: HeaderFields): Buffer => {
  const block = Buffer.alloc(BLOCK)

  block.write(fields.name, 0, 100, 'utf8')
  writeOctal(block, 100, 8, fields.mode)
  writeOctal(block, 108, 8, 0)
  writeOctal(block, 116, 8, 0)
  writeOctal(block, 124, 12, fitsSize(fields.size) ? fields.size : 0)
  writeOctal(block, 136, 12, fields.mtime)
  block.write(fields.typeflag, 156, 1, 'latin1')
  block.write(fields.linkname, 157, 100, 'utf8')
  block.write('ustar\0', 257, 6, 'latin1')
  block.write('00', 263, 2, 'latin1')
  block.write(`${checksumOf(block).toString(8).padStart(6, '0')}\0 `, 148, 8, 'latin1')

  return block
}

/**
 * Serializes the header blocks of an extracted entry, with a pax header for long values.
 * @param {TarEntry} entry - Entry to write
 * @returns {Buffer[]} - Header blocks, the entry's data follows them unchanged
 */
export const serializeEntry = (entry: TarEntry): Buffer[] => {
  const records: [string, string][] = []
  const nameFits = fitsField(entry.path, 100)
  const linkFits = fitsField(entry.linkpath, 100)

  if (!nameFits) {
    records.push(['path', entry.path])
  }

  if (!linkFits) {
    records.push(['linkpath', entry.linkpath])
  }

  if (!fitsSize(entry.size)) {
    records.push(['size', String(entry.size)])
  }

  const header = buildHeader({
    name: nameFits ? entry.path : PAX_NAME,
    linkname: linkFits ? entry.linkpath : '',
    mode: entry.mode,
    size: entry.size,
    mtime: entry.mtime,
    typeflag: TYPEFLAGS[entry.kind],
  })

  if (records.length === 0) {
    return [header]
  }

  const body = paxBody(records)
  const fields = { name: PAX_NAME, linkname: '', mode: 0o644, mtime: entry.mtime, typeflag: 'x' }

  return [
    buildHeader({ ...fields, size: body.length }),
    Buffer.concat([body, Buffer.alloc(padded(body.length) - body.length)]),
    header,
  ]
}
