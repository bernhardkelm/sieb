/** Size of a tar block, headers and data are padded to it */
export const BLOCK = 512

/** Malformed tar input, the export is refused */
export class TarFormatError extends Error {
  /**
   * Creates the error with a short description of the defect.
   * @param {string} message - Defect
   * @returns {void}
   */
  constructor(message: string) {
    super(message)
    this.name = 'TarFormatError'
  }
}

/** Fields of one tar header the filter needs */
export interface RawHeader {
  name: string
  linkname: string
  mode: number
  size: number
  mtime: number
  typeflag: string
}

/**
 * Returns the number of bytes a payload occupies once padded to whole blocks.
 * @param {number} size - Payload size in bytes
 * @returns {number} - Padded size
 */
export const padded = (size: number): number => Math.ceil(size / BLOCK) * BLOCK

/**
 * Returns whether a block holds only zero bytes, the end-of-archive marker.
 * @param {Buffer} block - One block
 * @returns {boolean} - Whether every byte is zero
 */
export const isZeroBlock = (block: Buffer): boolean => block.every((byte) => byte === 0)

/**
 * Reads a NUL-terminated string field.
 * @param {Buffer} block - Header block
 * @param {number} start - Field offset
 * @param {number} length - Field length
 * @returns {string} - Field text up to the first NUL
 */
const readString = (block: Buffer, start: number, length: number): string => {
  const nul = block.indexOf(0, start)
  const end = nul === -1 || nul > start + length ? start + length : nul

  return block.toString('utf8', start, end)
}

/**
 * Reads a numeric field, octal text or the base-256 form for large values.
 * @param {Buffer} block - Header block
 * @param {number} start - Field offset
 * @param {number} length - Field length
 * @returns {number} - Value
 * @throws {TarFormatError} - When the field is neither form
 */
const readNumber = (block: Buffer, start: number, length: number): number => {
  if ((block[start] ?? 0) & 0x80) {
    let value = 0

    for (let index = start + 1; index < start + length; index++) {
      value = value * 256 + (block[index] ?? 0)
    }

    return value
  }

  const text = readString(block, start, length).trim()

  if (!/^[0-7]*$/.test(text)) {
    throw new TarFormatError('invalid numeric header field')
  }

  return text ? Number.parseInt(text, 8) : 0
}

/**
 * Computes the header checksum with the checksum field counted as spaces.
 * @param {Buffer} block - Header block
 * @returns {number} - Unsigned byte sum
 */
export const checksumOf = (block: Buffer): number => {
  let sum = 0

  for (let index = 0; index < BLOCK; index++) {
    sum += index >= 148 && index < 156 ? 32 : (block[index] ?? 0)
  }

  return sum
}

/**
 * Parses a header block after verifying its checksum.
 * @param {Buffer} block - Header block
 * @returns {RawHeader} - Parsed fields, the ustar prefix joined into the name
 * @throws {TarFormatError} - On a checksum mismatch or a malformed field
 */
export const parseHeader = (block: Buffer): RawHeader => {
  if (readNumber(block, 148, 8) !== checksumOf(block)) {
    throw new TarFormatError('tar header checksum mismatch')
  }

  // the prefix field exists in POSIX ustar only, old GNU headers use those bytes for times
  const ustar = block.toString('latin1', 257, 263) === 'ustar\0'
  const prefix = ustar ? readString(block, 345, 155) : ''
  const name = readString(block, 0, 100)

  return {
    name: prefix ? `${prefix}/${name}` : name,
    linkname: readString(block, 157, 100),
    mode: readNumber(block, 100, 8),
    size: readNumber(block, 124, 12),
    mtime: readNumber(block, 136, 12),
    typeflag: String.fromCharCode(block[156] ?? 0),
  }
}
