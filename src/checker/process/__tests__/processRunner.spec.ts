// @vitest-environment node
import { tmpdir } from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'

import { describe, expect, it } from 'vitest'

import { processRunner, type ProcessSpec } from '#checker/process/processRunner.ts'
import { runCaptured } from '#checker/process/runCaptured.ts'

/**
 * Builds a shell command spec.
 * @param {string} script - Script for sh -c
 * @param {Partial<ProcessSpec>} rest - Fields to override
 * @returns {ProcessSpec} - Spec with PATH only
 */
const sh = (script: string, rest: Partial<ProcessSpec> = {}): ProcessSpec => ({
  command: 'sh',
  args: ['-c', script],
  cwd: tmpdir(),
  env: { PATH: '/usr/bin:/bin' },
  stdin: 'ignore',
  ...rest,
})

/**
 * Returns whether a process id is alive.
 * @param {number} pid - Process id
 * @returns {boolean} - Whether signal 0 reaches it
 */
const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)

    return true
  } catch {
    return false
  }
}

const NEVER = new AbortController().signal

describe('processRunner', () => {
  it('kills the whole process group, grandchildren included', async () => {
    const child = processRunner.spawn(sh('sleep 30 & echo $!; wait'))
    let grandchild = 0

    child.stdout.on('data', (chunk: Buffer) => {
      grandchild ||= Number(chunk.toString().trim())
    })
    while (grandchild === 0) {
      await sleep(10)
    }

    expect(alive(grandchild)).toBe(true)
    child.kill()
    expect((await child.exited).signal).toBe('SIGKILL')
    await sleep(50)
    expect(alive(grandchild)).toBe(false)
  })

  it('hands fd3Input over on file descriptor 3, not in env or argv', async () => {
    const run = await runCaptured(
      processRunner,
      sh('cat <&3; echo; env', { fd3Input: 'secret-token' }),
      { signal: NEVER, timeoutMs: 5000, maxStdoutBytes: 4096 },
    )
    const [first, ...env] = run.stdout.split('\n')

    expect(first).toBe('secret-token')
    expect(env.join('\n')).not.toContain('secret-token')
  })
})

describe('runCaptured', () => {
  it('kills at the timeout and marks the run', async () => {
    const run = await runCaptured(processRunner, sh('sleep 30'), {
      signal: NEVER,
      timeoutMs: 100,
      maxStdoutBytes: 10,
    })

    expect(run).toMatchObject({ timedOut: true, aborted: false })
    expect(run.exit.signal).toBe('SIGKILL')
  })

  it('kills on abort, also when the signal fired before the start', async () => {
    const stop = new AbortController()
    const running = runCaptured(processRunner, sh('sleep 30'), {
      signal: stop.signal,
      timeoutMs: 10_000,
      maxStdoutBytes: 10,
    })

    setTimeout(() => stop.abort(), 50)
    expect(await running).toMatchObject({ aborted: true, timedOut: false })
    expect(
      await runCaptured(processRunner, sh('sleep 30'), {
        signal: AbortSignal.abort(),
        timeoutMs: 10_000,
        maxStdoutBytes: 10,
      }),
    ).toMatchObject({ aborted: true })
  })

  it('keeps the head of stdout with a truncation flag and the tail of stderr', async () => {
    const run = await runCaptured(
      processRunner,
      sh(
        "printf 'abcdefghij%.0s' $(seq 100); i=0; while [ $i -lt 2000 ]; do echo err$i >&2; i=$((i+1)); done; echo last >&2",
      ),
      { signal: NEVER, timeoutMs: 10_000, maxStdoutBytes: 15 },
    )

    expect(run.stdout).toBe('abcdefghijabcde')
    expect(run.stdoutTruncated).toBe(true)
    expect(run.stderr.endsWith('err1999\nlast\n')).toBe(true)
    expect(run.stderr.length).toBeLessThanOrEqual(16 * 1024)
    expect(run.exit.code).toBe(0)
  })
})
