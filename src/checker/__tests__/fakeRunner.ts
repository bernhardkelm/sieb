import { writeFile } from 'node:fs/promises'
import { PassThrough } from 'node:stream'
import { finished } from 'node:stream/promises'

import type { ProcessExit, ProcessRunner, ProcessSpec } from '#checker/process/processRunner.ts'
import { tarArchive } from '#checker/__tests__/tarFixtures.ts'

/** A fake process the test drives */
export interface FakeProcess {
  spec: ProcessSpec
  stdin: PassThrough
  stdout: PassThrough
  stderr: PassThrough
  killed: boolean
  fd3Input: string | undefined
  exit: (code: number | null, signal?: string | null) => void
}

export type Behaviour = (process: FakeProcess) => void | Promise<void>

/**
 * Creates a process runner whose processes are driven by a behaviour function.
 * @param {Behaviour} behave - Called for every spawned process
 * @returns {{ runner: ProcessRunner, spawned: FakeProcess[] }} - Runner and the spawned processes
 */
export const createFakeRunner = (
  behave: Behaviour,
): { runner: ProcessRunner; spawned: FakeProcess[] } => {
  const spawned: FakeProcess[] = []
  const runner: ProcessRunner = {
    spawn: (spec) => {
      const stdin = new PassThrough()
      const stdout = new PassThrough()
      const stderr = new PassThrough()
      const { promise, resolve } = Promise.withResolvers<ProcessExit>()
      let done = false
      const proc: FakeProcess = {
        spec,
        stdin,
        stdout,
        stderr,
        killed: false,
        fd3Input: spec.fd3Input,
        exit: (code, signal = null) => {
          if (done) {
            return
          }

          done = true
          stdout.end()
          stderr.end()
          const closed = [stdout, stderr].map((stream) => finished(stream).catch(() => undefined))

          void Promise.all(closed).then(() => resolve({ code, signal, error: null }))
        },
      }

      spawned.push(proc)
      setImmediate(() => void behave(proc))

      return {
        stdin: spec.stdin === 'pipe' ? stdin : null,
        stdout,
        stderr,
        exited: promise,
        kill: () => {
          proc.killed = true
          proc.exit(null, 'SIGKILL')
        },
      }
    },
  }

  return { runner, spawned }
}

/** A successful claude -p json result */
export const CLAUDE_SUCCESS = JSON.stringify({
  type: 'result',
  subtype: 'success',
  is_error: false,
  result: '**CVE-2099-0001 · nginx:1.27** → not_affected · confidence high',
  num_turns: 7,
  total_cost_usd: 0.42,
  usage: {
    input_tokens: 1200,
    output_tokens: 300,
    cache_read_input_tokens: 5000,
    cache_creation_input_tokens: 800,
  },
})

/**
 * Returns a behaviour that acts like crane, tar, syft and claude succeeding, with overrides.
 * @param {Record<string, Behaviour>} overrides - Behaviours by key: "crane digest", "crane config", "crane export", "tar", "syft", "claude"
 * @returns {Behaviour} - Combined behaviour
 */
export const toolBehaviour =
  (overrides: Record<string, Behaviour> = {}): Behaviour =>
  async (proc) => {
    const { command, args } = proc.spec
    const key = command === 'crane' ? `crane ${args[0]}` : command
    const override = overrides[key]

    if (override) {
      await override(proc)

      return
    }

    if (key === 'crane digest') {
      proc.stdout.write(`sha256:${'a'.repeat(64)}\n`)
    } else if (key === 'crane config') {
      proc.stdout.write('{"architecture":"amd64","config":{"Env":["PATH=/usr/bin"]}}')
    } else if (key === 'crane export') {
      proc.stdout.write(tarArchive([{ name: 'etc/os-release', data: 'ID=alpine\n' }]))
    } else if (key === 'tar') {
      proc.stdin.resume()
      await finished(proc.stdin).catch(() => undefined)
    } else if (key === 'syft') {
      const output = args.find((arg) => arg.startsWith('json='))?.slice('json='.length) ?? ''

      await writeFile(output, '{"artifacts":[{"name":"musl","version":"1.2.5"}]}')
    } else if (key === 'claude') {
      proc.stdout.write(CLAUDE_SUCCESS)
    }

    proc.exit(0)
  }
