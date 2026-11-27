// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import type { WorkerResult } from '#core/check.ts'
import { WorkerApiError, type WorkerApi } from '#checker/api/workerApi.ts'
import { sendResult } from '#checker/check/sendResult.ts'

const RESULT: WorkerResult = {
  status: 'done',
  error: null,
  durationMs: 1,
  usage: null,
  reply: null,
}

/**
 * Sends the result against an API whose result call fails with the given errors in turn.
 * @param {unknown[]} failures - Errors of the first calls, later calls succeed
 * @returns {Promise<{ calls: number, lines: string[] }>} - Number of attempts and log lines
 */
const send = async (failures: unknown[]): Promise<{ calls: number; lines: string[] }> => {
  const lines: string[] = []
  const result = vi.fn<WorkerApi['result']>(async () => {
    const failure = failures.shift()

    if (failure !== undefined) {
      throw failure
    }
  })
  const api: WorkerApi = {
    claim: vi.fn<WorkerApi['claim']>(),
    heartbeat: vi.fn<WorkerApi['heartbeat']>(),
    result,
  }

  await sendResult({ api, log: (line) => lines.push(line), resultRetryMs: 1 }, 7, RESULT)

  return { calls: result.mock.calls.length, lines }
}

describe('sendResult', () => {
  it('retries network errors, timeouts, rate limits and server errors', async () => {
    expect((await send([new TypeError('fetch failed'), new WorkerApiError('/r', 503)])).calls).toBe(
      3,
    )
    expect((await send([new WorkerApiError('/r', 429)])).calls).toBe(2)
    expect((await send([new WorkerApiError('/r', 408)])).calls).toBe(2)
  })

  it('gives up at once on other client errors', async () => {
    for (const status of [400, 404, 413]) {
      const { calls, lines } = await send([new WorkerApiError('/r', status)])

      expect(calls).toBe(1)
      expect(lines).toEqual([
        `[sieb-checker] result of check 7 failed (1): /r answered ${status}, giving up`,
      ])
    }
  })

  it('stops after three attempts', async () => {
    const errors = [1, 2, 3, 4].map(() => new WorkerApiError('/r', 502))

    expect((await send(errors)).calls).toBe(3)
  })
})
