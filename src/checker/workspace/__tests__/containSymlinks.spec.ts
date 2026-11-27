// @vitest-environment node
import { mkdir, mkdtemp, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { containSymlinks } from '#checker/workspace/containSymlinks.ts'

describe('containSymlinks', () => {
  let base = ''
  let root = ''

  beforeEach(async () => {
    base = await mkdtemp(join(tmpdir(), 'sieb-links-'))
    root = join(base, 'image')
    await mkdir(join(root, 'usr/lib'), { recursive: true })
    await mkdir(join(root, 'etc'), { recursive: true })
    await writeFile(join(root, 'usr/lib/libssl.so.3'), 'elf')
    await writeFile(join(base, 'mcp.json'), 'token')
  })

  afterEach(async () => {
    await rm(base, { recursive: true, force: true })
  })

  it('rewrites absolute targets relative to the image root', async () => {
    await symlink('/usr/lib/libssl.so.3', join(root, 'usr/lib/libssl.so'))
    await symlink('/', join(root, 'etc/rootlink'))

    expect(await containSymlinks(root)).toEqual({ rewritten: 2, removed: 0 })
    expect(await readlink(join(root, 'usr/lib/libssl.so'))).toBe('libssl.so.3')
    expect(await readlink(join(root, 'etc/rootlink'))).toBe('..')
  })

  it('keeps relative links inside and removes escaping and dangling ones', async () => {
    await symlink('libssl.so.3', join(root, 'usr/lib/inside'))
    await symlink('../../mcp.json', join(root, 'etc/escape'))
    await symlink('missing', join(root, 'etc/dangling'))
    await symlink('/proc/self/environ', join(root, 'etc/environ'))

    expect(await containSymlinks(root)).toEqual({ rewritten: 2, removed: 3 })
    expect(await readlink(join(root, 'usr/lib/inside'))).toBe('libssl.so.3')
    await expect(readlink(join(root, 'etc/escape'))).rejects.toThrow('ENOENT')
    await expect(readlink(join(root, 'etc/environ'))).rejects.toThrow('ENOENT')
  })

  it('removes links that escape through another link', async () => {
    await mkdir(join(root, 'x/y'), { recursive: true })
    await symlink('../..', join(root, 'x/y/up'))
    await symlink('x/y/up/..', join(root, 'escape'))

    expect(await containSymlinks(root)).toEqual({ rewritten: 0, removed: 1 })
    await expect(readlink(join(root, 'escape'))).rejects.toThrow('ENOENT')
  })

  it('rewrites relative links that climb above the root as the container resolves them', async () => {
    await mkdir(join(root, 'opt/app/lib'), { recursive: true })
    await symlink('../../../../../usr/lib/libssl.so.3', join(root, 'opt/app/lib/libssl.so'))

    expect(await containSymlinks(root)).toEqual({ rewritten: 1, removed: 0 })
    expect(await readlink(join(root, 'opt/app/lib/libssl.so'))).toBe('../../../usr/lib/libssl.so.3')
  })

  it('clamps /../../etc to the image root and removes symlink loops', async () => {
    await writeFile(join(root, 'etc/os-release'), 'ID=alpine')
    await symlink('/../../etc/os-release', join(root, 'usr/os-release'))
    await symlink('loop-b', join(root, 'etc/loop-a'))
    await symlink('loop-a', join(root, 'etc/loop-b'))

    expect(await containSymlinks(root)).toEqual({ rewritten: 1, removed: 2 })
    expect(await readlink(join(root, 'usr/os-release'))).toBe('../etc/os-release')
    await expect(readlink(join(root, 'etc/loop-a'))).rejects.toThrow('ENOENT')
  })
})
