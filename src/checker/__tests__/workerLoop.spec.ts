// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import type { WorkerClaim, WorkerResult } from '#core/check.ts'
import { CLAIM } from '#checker/__tests__/checkFixtures.ts'
import { InvalidClaimError } from '#checker/api/parseClaim.ts'
import type { WorkerApi } from '#checker/api/workerApi.ts'
import { nextBackoff, runWorkerLoop } from '#checker/check/workerLoop.ts'

const DONE: WorkerResult = {
  status: 'done',
  error: null,
  durationMs: 1000,
  usage: null,
  reply: null,
}

/**
 * Runs the loop over a scripted sequence of claim answers, stopping once the script is used up.
 * @param {(() => Promise<WorkerClaim | null>)[]} answers - Claim answers in order
 * @returns {Promise<{ sleeps: number[], checks: WorkerClaim[], results: unknown[] }>} - Recorded calls
 */
const runScripted = async (answers: (() => Promise<WorkerClaim | null>)[]) => {
  const stop = new AbortController()
  const sleeps: number[] = []
  const checks: WorkerClaim[] = []
  const results: unknown[] = []
  let call = 0
  const api: WorkerApi = {
    claim: () => {
      const answer = answers[call++]

      if (call >= answers.length) {
        stop.abort('done')
      }

      return answer ? answer() : Promise.resolve(null)
    },
    heartbeat: vi.fn<WorkerApi['heartbeat']>(),
    result: async (checkId, body) => {
      results.push([checkId, body])
    },
  }

  await runWorkerLoop({
    api,
    pollMs: 10_000,
    stopSignal: stop.signal,
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    check: async (claim) => {
      checks.push(claim)

      return DONE
    },
    log: () => undefined,
  })

  return { sleeps, checks, results }
}

describe('runWorkerLoop', () => {
  it('runs claimed checks and waits one poll interval on an empty queue', async () => {
    const { sleeps, checks } = await runScripted([
      async () => CLAIM,
      async () => null,
      async () => ({ ...CLAIM, checkId: 8 }),
    ])

    expect(checks.map((claim) => claim.checkId)).toEqual([7, 8])
    expect(sleeps).toEqual([10_000])
  })

  it('backs off exponentially on errors and resets after a success', async () => {
    const fail = async (): Promise<never> => {
      throw new TypeError('fetch failed')
    }
    const { sleeps } = await runScripted([
      fail,
      fail,
      fail,
      async () => null,
      fail,
      async () => CLAIM,
    ])

    expect(sleeps).toEqual([10_000, 20_000, 40_000, 10_000, 10_000])
  })

  it('reports an invalid claim with a known id as failed', async () => {
    const invalid = async (): Promise<never> => {
      throw new InvalidClaimError('imageRef', 9)
    }
    const { results, checks } = await runScripted([invalid, async () => CLAIM])

    expect(checks).toHaveLength(1)
    expect(results).toEqual([
      [9, expect.objectContaining({ status: 'failed', error: 'invalid claim: imageRef' })],
    ])
  })

  it('caps the backoff at five minutes', () => {
    expect(nextBackoff(0, 10_000)).toBe(10_000)
    expect(nextBackoff(240_000, 10_000)).toBe(300_000)
    expect(nextBackoff(300_000, 10_000)).toBe(300_000)
  })
})
