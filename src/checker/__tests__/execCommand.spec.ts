// @vitest-environment node
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'

import { execCommand, type CommandOptions } from '#checker/inspect/execCommand.ts'

const OPTIONS: CommandOptions = {
  path: '/usr/bin:/bin',
  cwd: tmpdir(),
  timeoutMs: 5000,
  maxBytes: 1024,
}

/**
 * Runs a Node script as the command under test.
 * @param {string} script - Script for node -e
 * @param {Partial<CommandOptions>} options - Options to override
 * @returns {ReturnType<typeof execCommand>} - Command outcome
 */
const node = (script: string, options: Partial<CommandOptions> = {}) =>
  execCommand(process.execPath, ['-e', script], { ...OPTIONS, ...options })

describe('execCommand', () => {
  it('gives the command PATH as its only variable', async () => {
    process.env.SIEB_TEST_SECRET = 'secret'
    const output = await node('process.stdout.write(JSON.stringify(Object.keys(process.env)))')

    delete process.env.SIEB_TEST_SECRET
    expect(output.code).toBe(0)
    // macOS adds __CF_USER_TEXT_ENCODING to every process
    const keys = (JSON.parse(output.stdout.toString()) as string[]).filter(
      (key) => !key.startsWith('__CF_'),
    )

    expect(keys).toEqual(['PATH'])
  })

  it('cuts stdout at the cap and reports it', async () => {
    const output = await node("process.stdout.write('x'.repeat(100000))")

    expect(output.truncated).toBe(true)
    expect(output.stdout.length).toBe(1024)
  })

  it('kills a command that passes the timeout', async () => {
    const output = await node('setTimeout(() => {}, 10000)', { timeoutMs: 200 })

    expect(output.timedOut).toBe(true)
    expect(output.code).toBeNull()
  })

  it('passes stdin and reports the exit code and stderr', async () => {
    const echo = await node('process.stdin.pipe(process.stdout)', { input: Buffer.from('abc') })
    const failed = await node("console.error('boom'); process.exit(3)")

    expect(echo.stdout.toString()).toBe('abc')
    expect(failed).toMatchObject({ code: 3, timedOut: false, truncated: false })
    expect(failed.stderr).toContain('boom')
  })

  it('reports a failing command with a stderr flood as an error, not as cut output', async () => {
    const output = await node("process.stderr.write('w'.repeat(200000)); process.exit(4)")

    expect(output).toMatchObject({ code: 4, truncated: false, timedOut: false })
    expect(output.stderr).toHaveLength(2000)
  })
})
