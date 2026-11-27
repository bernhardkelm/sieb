import { TarFormatError } from '#checker/tar/tarHeader.ts'

/** Values of pax and GNU long-name records that override the next header */
export interface HeaderOverrides {
  path?: string
  linkpath?: string
  size?: number
}

/**
 * Parses pax extended header records of the form "<length> <key>=<value>\n".
 * @param {Buffer} data - Record payload
 * @returns {Map<string, string>} - Values by key, later records win
 * @throws {TarFormatError} - When a record length is malformed
 */
export const parsePaxRecords = (data: Buffer): Map<string, string> => {
  const records = new Map<string, string>()
  let position = 0

  while (position < data.length && data[position] !== 0) {
    const space = data.indexOf(0x20, position)
    const length = Number(data.toString('latin1', position, space))

    if (
      space === -1 ||
      !Number.isInteger(length) ||
      length <= space - position ||
      position + length > data.length
    ) {
      throw new TarFormatError('malformed pax record')
    }

    const record = data.toString('utf8', space + 1, position + length - 1)
    const equals = record.indexOf('=')

    if (equals > 0) {
      records.set(record.slice(0, equals), record.slice(equals + 1))
    }

    position += length
  }

  return records
}

/**
 * Applies a pax extended header to the overrides of the next entry.
 * @param {HeaderOverrides} overrides - Overrides collected so far, changed in place
 * @param {Buffer} data - Record payload
 * @returns {void}
 * @throws {TarFormatError} - When a size record is not a non-negative integer
 */
export const applyPaxRecords = (overrides: HeaderOverrides, data: Buffer): void => {
  const records = parsePaxRecords(data)
  const path = records.get('path')
  const linkpath = records.get('linkpath')
  const size = records.get('size')

  if (path !== undefined) {
    overrides.path = path
  }

  if (linkpath !== undefined) {
    overrides.linkpath = linkpath
  }

  if (size !== undefined) {
    if (!/^\d+$/.test(size)) {
      throw new TarFormatError('malformed pax size')
    }

    overrides.size = Number(size)
  }
}

/**
 * Reads the NUL-terminated name of a GNU long-name or long-link record.
 * @param {Buffer} data - Record payload
 * @returns {string} - Name
 */
export const readLongName = (data: Buffer): string => {
  const nul = data.indexOf(0)

  return data.toString('utf8', 0, nul === -1 ? data.length : nul)
}

/**
 * Returns the length of a pax record including its own decimal length prefix.
 * @param {number} rest - Byte length of " <key>=<value>\n"
 * @returns {number} - Total record length
 */
const recordLength = (rest: number): number => {
  for (let digits = 1; ; digits++) {
    if (String(rest + digits).length === digits) {
      return rest + digits
    }
  }
}

/**
 * Serializes pax records.
 * @param {[string, string][]} records - Key and value pairs
 * @returns {Buffer} - Record payload, unpadded
 */
export const paxBody = (records: [string, string][]): Buffer =>
  Buffer.concat(
    records.map(([key, value]) => {
      const rest = ` ${key}=${value}\n`
      const length = recordLength(Buffer.byteLength(rest))

      return Buffer.from(`${length}${rest}`, 'utf8')
    }),
  )
