// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { filterArchive, readArchive, tarArchive } from '#checker/__tests__/tarFixtures.ts'
import { BLOCK, checksumOf } from '#checker/tar/tarHeader.ts'
import { paxBody } from '#checker/tar/tarPax.ts'

/**
 * Writes bytes into a header of an archive and fixes its checksum.
 * @param {Buffer} archive - Archive, changed in place
 * @param {number} offset - Field offset in the header
 * @param {Buffer} bytes - Field content
 * @param {number} headerAt - Byte offset of the header in the archive
 * @returns {Buffer} - The archive
 */
const patchHeader = (archive: Buffer, offset: number, bytes: Buffer, headerAt = 0): Buffer => {
  const header = archive.subarray(headerAt, headerAt + BLOCK)

  bytes.copy(header, offset)
  header.write(`${checksumOf(header).toString(8).padStart(6, '0')}\0 `, 148, 8, 'latin1')

  return archive
}

/**
 * Returns name, type and link target of the entries the filter wrote.
 * @param {Buffer} output - Filter output
 * @returns {string[][]} - Rows of name, type and link target
 */
const names = (output: Buffer): string[][] =>
  readArchive(output).map((entry) => [entry.name, entry.type, entry.linkname])

describe('tar filter edge cases', () => {
  it('treats a hard link to a symlink as that symlink (audit reproduction)', async () => {
    const { output, stats } = await filterArchive(
      tarArchive([
        { name: 'sub', type: '5' },
        { name: 's', type: '2', linkname: 'sub' },
        { name: 'h', type: '1', linkname: 's' },
        { name: 's/x', data: 'blocked' },
        { name: 'h/x', data: 'through hardlinked symlink' },
      ]),
    )

    expect(names(output)).toEqual([
      ['sub', '5', ''],
      ['s', '2', 'sub'],
      ['h', '1', 's'],
    ])
    expect(stats.dropped.under_symlink).toBe(2)
  })

  it('follows chains of symlinks and hard links to absolute targets', async () => {
    const { output, stats } = await filterArchive(
      tarArchive([
        { name: 'a', type: '2', linkname: '/work' },
        { name: 'b', type: '2', linkname: 'a' },
        { name: 'c', type: '1', linkname: 'b' },
        { name: 'd', type: '1', linkname: 'c' },
        { name: 'c/escape/pwned', data: 'x' },
        { name: 'd/pwned', data: 'x' },
      ]),
    )

    expect(names(output).map(([name]) => name)).toEqual(['a', 'b', 'c', 'd'])
    expect(stats.dropped.under_symlink).toBe(2)
  })

  it('drops hard links to directories and an entry at the path of an earlier symlink', async () => {
    const { output, stats } = await filterArchive(
      tarArchive([
        { name: 'dir', type: '5' },
        { name: 'dirlink', type: '1', linkname: 'dir' },
        { name: 'link', type: '2', linkname: 'dir' },
        { name: 'link', data: 'replaces the link' },
        { name: 'empty', type: '2', linkname: '' },
      ]),
    )

    expect(names(output)).toEqual([
      ['dir', '5', ''],
      ['link', '2', 'dir'],
    ])
    expect(stats.dropped).toMatchObject({ link_target: 2, under_symlink: 1 })
  })

  it('drops the ignore files ripgrep honours, keeps directories of that name', async () => {
    const { output, stats } = await filterArchive(
      tarArchive([
        { name: 'app/.gitignore', data: '*' },
        { name: 'app/.ignore', data: '*' },
        { name: '.rgignore', data: '*' },
        { name: 'app/.git/info/exclude', data: '*' },
        { name: 'app/.gitignore.d/', type: '5' },
        { name: 'srv/.ignore', type: '2', linkname: '/etc/x' },
        { name: 'app/main.js', data: 'secret()' },
      ]),
    )

    expect(names(output).map(([name]) => name)).toEqual(['app/.gitignore.d', 'app/main.js'])
    expect(stats.dropped.ignore_file).toBe(5)
  })

  it('reads base-256 numeric fields', async () => {
    const archive = tarArchive([{ name: 'big-mtime', data: 'x' }])
    const mtime = Buffer.alloc(12)

    mtime[0] = 0x80
    mtime.writeUInt32BE(1_700_000_000, 8)
    const { output } = await filterArchive(patchHeader(archive, 136, mtime))

    expect(names(output)).toEqual([['big-mtime', '0', '']])
  })

  it('applies pax size and linkpath overrides and ignores global pax headers', async () => {
    const long = `usr/lib/${'l'.repeat(120)}.so`
    const sized = tarArchive([{ name: 'sized', data: 'abc', pax: [['size', '3']] }], false)

    // header size 0, the pax record carries the real size
    patchHeader(sized, 124, Buffer.from('00000000000\0'), 2 * BLOCK)
    const { output, stats } = await filterArchive(
      Buffer.concat([
        tarArchive(
          [
            { name: 'g', type: 'g', data: paxBody([['path', '/etc/passwd']]).toString('latin1') },
            { name: 'x', pax: [['path', long]], data: 'elf' },
            { name: 'short', type: '2', linkname: 'x', pax: [['linkpath', long]] },
          ],
          false,
        ),
        sized,
        Buffer.alloc(2 * BLOCK),
      ]),
    )

    expect(readArchive(output).map((entry) => [entry.name, entry.linkname, entry.data])).toEqual([
      [long, '', 'elf'],
      ['short', long, ''],
      ['sized', '', 'abc'],
    ])
    expect(stats.dropped.unsafe_path).toBe(0)
  })

  it('drops a ustar prefix with .. and rejects meta records above 1 MiB', async () => {
    const archive = tarArchive([
      { name: 'etc/passwd', data: 'x' },
      { name: 'ok', data: 'y' },
    ])
    const { output, stats } = await filterArchive(patchHeader(archive, 345, Buffer.from('a/../..')))

    expect(names(output).map(([name]) => name)).toEqual(['ok'])
    expect(stats.dropped.unsafe_path).toBe(1)

    const meta = tarArchive([{ name: 'pax', type: 'x', data: 'a'.repeat(1024 * 1024 + 1) }])

    await expect(filterArchive(meta, 4 * 1024 * 1024)).rejects.toThrow('tar meta record too large')
  })
})
