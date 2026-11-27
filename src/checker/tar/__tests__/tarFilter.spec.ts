// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { filterArchive, readArchive, tarArchive } from '#checker/tar/__tests__/tarFixtures.ts'
import { ExportTooLargeError } from '#checker/tar/tarFilter.ts'
import { TarFormatError } from '#checker/tar/tarHeader.ts'

describe('createTarFilter', () => {
  it('passes files, directories and symlinks with fresh headers and normalized modes', async () => {
    const input = tarArchive([
      { name: './etc/', type: '5', mode: 0o1777 },
      { name: './etc/passwd', data: 'root:x:0:0\n', mode: 0o4755 },
      { name: 'usr/lib/libssl.so', type: '2', linkname: '/usr/lib/libssl.so.3' },
      { name: 'usr/lib/readme', data: 'x', mode: 0o600 },
    ])
    const { output, stats } = await filterArchive(input)

    expect(readArchive(output)).toEqual([
      { name: 'etc', type: '5', linkname: '', mode: 0o755, data: '' },
      { name: 'etc/passwd', type: '0', linkname: '', mode: 0o755, data: 'root:x:0:0\n' },
      {
        name: 'usr/lib/libssl.so',
        type: '2',
        linkname: '/usr/lib/libssl.so.3',
        mode: 0o777,
        data: '',
      },
      { name: 'usr/lib/readme', type: '0', linkname: '', mode: 0o644, data: 'x' },
    ])
    expect(stats.entries).toBe(4)
  })

  it('drops absolute and parent paths, device files and fifos', async () => {
    const input = tarArchive([
      { name: '/etc/shadow', data: 'secret' },
      { name: 'a/../../outside', data: 'x' },
      { name: 'dev/sda', type: '4' },
      { name: 'dev/tty', type: '3' },
      { name: 'run/fifo', type: '6' },
      { name: 'ok', data: 'kept' },
    ])
    const { output, stats } = await filterArchive(input)

    expect(readArchive(output).map((entry) => entry.name)).toEqual(['ok'])
    expect(stats.dropped).toEqual({
      unsafe_path: 2,
      special_file: 3,
      under_symlink: 0,
      link_target: 0,
      ignore_file: 0,
    })
  })

  it('drops entries below an extracted symlink and hard links to anything not extracted', async () => {
    const input = tarArchive([
      { name: 'escape', type: '2', linkname: '/' },
      { name: 'escape/etc/cron.d/job', data: 'x' },
      { name: 'bin/sh', data: '#!' },
      { name: 'bin/ash', type: '1', linkname: 'bin/sh' },
      { name: 'bin/bad', type: '1', linkname: '../../etc/passwd' },
      { name: 'bin/missing', type: '1', linkname: 'nowhere' },
    ])
    const { output, stats } = await filterArchive(input)

    expect(readArchive(output).map((entry) => [entry.name, entry.linkname])).toEqual([
      ['escape', '/'],
      ['bin/sh', ''],
      ['bin/ash', 'bin/sh'],
    ])
    expect(stats.dropped.under_symlink).toBe(1)
    expect(stats.dropped.link_target).toBe(2)
  })

  it('reads pax and GNU long names and writes long names as pax records', async () => {
    const long = `opt/${'d'.repeat(120)}/file`
    const input = tarArchive([
      { name: 'ignored', pax: [['path', long]], data: 'pax' },
      { name: '././@LongLink', longName: `${long}2`, data: 'gnu' },
      { name: 'evil', pax: [['path', '/etc/passwd']], data: 'x' },
    ])
    const { output, stats } = await filterArchive(input)

    expect(readArchive(output).map((entry) => [entry.name, entry.data])).toEqual([
      [long, 'pax'],
      [`${long}2`, 'gnu'],
    ])
    expect(stats.dropped.unsafe_path).toBe(1)
  })

  it('fails once the input passes the byte cap', async () => {
    const input = tarArchive([{ name: 'big', data: 'x'.repeat(4096) }])

    await expect(filterArchive(input, 2048)).rejects.toBeInstanceOf(ExportTooLargeError)
  })

  it('rejects a corrupt header and a stream that ends mid-entry', async () => {
    const corrupt = tarArchive([{ name: 'a', data: 'x' }])

    corrupt[0] = 'b'.charCodeAt(0)
    await expect(filterArchive(corrupt)).rejects.toBeInstanceOf(TarFormatError)

    const truncated = tarArchive([{ name: 'a', data: 'x'.repeat(2000) }], false).subarray(0, 1024)

    await expect(filterArchive(truncated)).rejects.toBeInstanceOf(TarFormatError)
  })

  it('appends the end marker when the input lacks it', async () => {
    const { output } = await filterArchive(tarArchive([{ name: 'a', data: 'x' }], false))

    expect(output.subarray(-1024).every((byte) => byte === 0)).toBe(true)
    expect(readArchive(output).map((entry) => entry.name)).toEqual(['a'])
  })
})
