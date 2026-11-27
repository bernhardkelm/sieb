// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { filterArchive, readArchive, tarArchive } from '#checker/tar/__tests__/tarFixtures.ts'
import { BLOCK, isZeroBlock, padded, parseHeader } from '#checker/tar/tarHeader.ts'

/**
 * Returns the raw headers of an archive, pax headers included, without applying any records.
 * @param {Buffer} archive - Filter output
 * @returns {{ name: string, type: string, linkname: string }[]} - Headers in order
 */
const rawHeaders = (archive: Buffer): { name: string; type: string; linkname: string }[] => {
  const headers: { name: string; type: string; linkname: string }[] = []

  for (let offset = 0; offset + BLOCK <= archive.length;) {
    const block = archive.subarray(offset, offset + BLOCK)

    if (isZeroBlock(block)) {
      break
    }

    const header = parseHeader(block)

    headers.push({ name: header.name, type: header.typeflag, linkname: header.linkname })
    offset += BLOCK + padded(header.size)
  }

  return headers
}

describe('tar filter long link targets', () => {
  it('keeps a hard link whose pax linkpath is longer than 100 bytes', async () => {
    const long = `vendor/${'d'.repeat(110)}/lib.so`
    const { output, stats } = await filterArchive(
      tarArchive([
        { name: 'target', pax: [['path', long]], data: 'elf' },
        { name: 'alias', type: '1', linkname: 'ignored', pax: [['linkpath', long]] },
      ]),
    )

    expect(readArchive(output).map((entry) => [entry.name, entry.type, entry.linkname])).toEqual([
      [long, '0', ''],
      ['alias', '1', long],
    ])
    expect(stats.dropped.link_target).toBe(0)
    expect(rawHeaders(output).slice(2)).toEqual([
      { name: 'PaxHeader', type: 'x', linkname: '' },
      { name: 'alias', type: '1', linkname: '' },
    ])
  })

  it('writes a symlink target of exactly 100 bytes as a pax record, 99 bytes inline', async () => {
    const hundred = 'a'.repeat(100)
    const ninetyNine = 'b'.repeat(99)
    const { output, stats } = await filterArchive(
      tarArchive([
        { name: 'wide', type: '2', linkname: hundred },
        { name: 'narrow', type: '2', linkname: ninetyNine },
      ]),
    )

    expect(readArchive(output).map((entry) => [entry.name, entry.linkname])).toEqual([
      ['wide', hundred],
      ['narrow', ninetyNine],
    ])
    expect(stats.dropped.link_target).toBe(0)
    expect(rawHeaders(output).map((header) => [header.name, header.linkname])).toEqual([
      ['PaxHeader', ''],
      ['wide', ''],
      ['narrow', ninetyNine],
    ])
  })

  it('reads a GNU long-link record and writes the target back as pax', async () => {
    const long = `/opt/${'t'.repeat(150)}`
    const { output } = await filterArchive(
      tarArchive([
        { name: '././@LongLink', type: 'K', data: `${long}\0` },
        { name: 'gnu', type: '2', linkname: long.slice(0, 99) },
      ]),
    )

    expect(readArchive(output).map((entry) => [entry.name, entry.type, entry.linkname])).toEqual([
      ['gnu', '2', long],
    ])
  })
})
