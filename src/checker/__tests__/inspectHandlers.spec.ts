// @vitest-environment node
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CommandOutput, ExecCommand } from '#checker/inspect/execCommand.ts'
import { createInspectHandlers } from '#checker/inspect/inspectHandlers.ts'

/**
 * Builds a command outcome.
 * @param {string} stdout - Output text
 * @param {Partial<CommandOutput>} rest - Fields to override
 * @returns {CommandOutput} - Outcome with exit code 0 by default
 */
const output = (stdout: string, rest: Partial<CommandOutput> = {}): CommandOutput => ({
  stdout: Buffer.from(stdout),
  stderr: '',
  code: 0,
  truncated: false,
  timedOut: false,
  ...rest,
})

/**
 * Returns the text of a tool result.
 * @param {{ content: unknown[] }} result - Tool result
 * @returns {string} - Text of the first block
 */
const text = (result: { content: unknown[] }): string =>
  (result.content[0] as { text: string }).text

describe('inspect handlers', () => {
  let base = ''
  let root = ''
  let exec: ReturnType<typeof vi.fn<ExecCommand>>

  beforeEach(async () => {
    base = await realpath(await mkdtemp(join(tmpdir(), 'sieb-inspect-')))
    root = join(base, 'workspace')
    await mkdir(join(root, 'image/usr/bin'), { recursive: true })
    await writeFile(join(root, 'image/usr/bin/curl'), 'ELF')
    await writeFile(join(root, 'inventory.json'), '{"artifacts":[]}')
    await writeFile(join(base, 'mcp.json'), '{"token":"secret"}')
    await symlink('../../mcp.json', join(root, 'image/escape.json'))
    await symlink('curl', join(root, 'image/usr/bin/curl-link'))
    exec = vi.fn<ExecCommand>(async () => output('libcurl.so.4\nOpenSSL 3.3.1\n'))
  })

  afterEach(async () => {
    await rm(base, { recursive: true, force: true })
  })

  /**
   * Creates the handlers on the test workspace.
   * @param {number} maxBytes - Output cap
   * @returns {ReturnType<typeof createInspectHandlers>} - Handlers
   */
  const handlers = (maxBytes = 1024) =>
    createInspectHandlers({ root, exec, path: '/usr/bin:/bin', timeoutMs: 30_000, maxBytes })

  it('runs the command on the resolved file with PATH, the workspace and the limits', async () => {
    const result = await handlers().readelf({ path: 'image/usr/bin/curl-link', mode: 'dynamic' })

    expect(text(result)).toContain('libcurl.so.4')
    expect(exec).toHaveBeenCalledWith('readelf', ['-d', '-W', join(root, 'image/usr/bin/curl')], {
      path: '/usr/bin:/bin',
      cwd: root,
      timeoutMs: 30_000,
      maxBytes: 1024,
    })
  })

  it('rejects absolute, parent, escaping, missing and directory paths without running anything', async () => {
    const paths = [
      join(base, 'mcp.json'),
      '/etc/passwd',
      '../mcp.json',
      'image/../../mcp.json',
      'image/escape.json',
      'image/missing',
      'image/usr',
      'image/usr/bin/curl\0',
    ]

    for (const path of paths) {
      const result = await handlers().strings({ path })

      expect(result.isError).toBe(true)
      expect(text(result)).toContain('is not a file inside the workspace')
    }
    expect(await handlers().jq({ path: 'image/escape.json', filter: '.' })).toMatchObject({
      isError: true,
    })
    expect(exec).not.toHaveBeenCalled()
  })

  it('accepts absolute paths inside the workspace', async () => {
    const result = await handlers().unzip_list({ path: join(root, 'image/usr/bin/curl') })

    expect(result.isError).toBeUndefined()
    expect(exec).toHaveBeenCalledWith(
      'unzip',
      ['-l', join(root, 'image/usr/bin/curl')],
      expect.anything(),
    )
  })

  it('filters strings by substring in Node and by regex through grep', async () => {
    const plain = await handlers().strings({
      path: 'image/usr/bin/curl',
      pattern: 'openssl',
      ignoreCase: true,
    })

    expect(text(plain)).toBe('OpenSSL 3.3.1')
    exec
      .mockResolvedValueOnce(output('OpenSSL 3.3.1\n'))
      .mockResolvedValueOnce(output('OpenSSL 3.3.1\n'))
    await handlers().strings({
      path: 'image/usr/bin/curl',
      pattern: 'OpenSSL [0-9.]+',
      regex: true,
    })

    expect(exec.mock.calls.at(-1)?.slice(0, 2)).toEqual([
      'grep',
      ['-E', '-e', 'OpenSSL [0-9.]+', '-'],
    ])
    expect(exec.mock.calls.at(-1)?.[2].input?.toString()).toBe('OpenSSL 3.3.1\n')
  })

  it('caps the output with a note and reports timeouts and failures as errors', async () => {
    exec.mockResolvedValueOnce(output('x'.repeat(100), { code: null, truncated: true }))
    expect(text(await handlers(100).strings({ path: 'image/usr/bin/curl' }))).toBe(
      `${'x'.repeat(100)}\n[output truncated at 100 bytes]`,
    )

    exec.mockResolvedValueOnce(output('x'.repeat(2000)))
    expect(text(await handlers(100).strings({ path: 'image/usr/bin/curl' }))).toBe(
      `${'x'.repeat(100)}\n[output truncated at 100 bytes]`,
    )

    exec.mockResolvedValueOnce(output('', { code: null, timedOut: true }))
    expect(
      await handlers().objdump({ path: 'image/usr/bin/curl', mode: 'private_headers' }),
    ).toEqual({
      content: [{ type: 'text', text: 'objdump timed out after 30 s' }],
      isError: true,
    })

    exec.mockResolvedValueOnce(output('', { code: 1, stderr: 'readelf: Error: Not an ELF file\n' }))
    expect(text(await handlers().readelf({ path: 'inventory.json', mode: 'header' }))).toBe(
      'readelf exited with 1: readelf: Error: Not an ELF file',
    )
  })

  it('refuses a disassembly without a valid symbol and jq on other files', async () => {
    const disassemble = await handlers().objdump({
      path: 'image/usr/bin/curl',
      mode: 'disassemble_symbol',
    })
    const jq = await handlers().jq({ path: 'image/usr/bin/curl', filter: '.' })

    expect(text(disassemble)).toContain('disassemble_symbol needs a symbol')
    expect(text(jq)).toBe('jq reads only .json files')
    expect(exec).not.toHaveBeenCalled()
  })

  it('notes that pattern matches past the strings input cap are missing', async () => {
    exec.mockResolvedValueOnce(output('OpenSSL 3.3.1\nzlib\n', { code: null, truncated: true }))
    expect(text(await handlers().strings({ path: 'image/usr/bin/curl', pattern: 'OpenSSL' }))).toBe(
      'OpenSSL 3.3.1\n[strings output cut at 33554432 bytes before filtering, later matches are missing]',
    )

    exec
      .mockResolvedValueOnce(output('OpenSSL 3.3.1\n', { code: null, truncated: true }))
      .mockResolvedValueOnce(output('OpenSSL 3.3.1\n'))
    expect(
      text(
        await handlers().strings({ path: 'image/usr/bin/curl', pattern: 'Open.SSL', regex: true }),
      ),
    ).toContain('later matches are missing')

    exec.mockResolvedValueOnce(output('OpenSSL\n'.repeat(50)))
    expect(
      text(await handlers(100).strings({ path: 'image/usr/bin/curl', pattern: 'OpenSSL' })),
    ).toMatch(/\n\[output truncated at 100 bytes\]$/)
  })
})
