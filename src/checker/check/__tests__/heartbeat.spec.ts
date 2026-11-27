// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkerApi } from '#checker/api/workerApi.ts'
import { startHeartbeat } from '#checker/check/heartbeat.ts'

/**
 * Creates a fake API whose heartbeat answers come from a function.
 * @param {() => Promise<'ok' | 'abort'>} answer - Heartbeat answer
 * @returns {WorkerApi} - Fake API
 */
const fakeApi = (answer: () => Promise<'ok' | 'abort'>): WorkerApi => ({
  claim: vi.fn<WorkerApi['claim']>(),
  heartbeat: vi.fn<WorkerApi['heartbeat']>(answer),
  result: vi.fn<WorkerApi['result']>(),
})

describe('startHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('beats at once, on phase changes and every 30 seconds', async () => {
    const api = fakeApi(async () => 'ok')
    const heartbeat = startHeartbeat({
      api,
      checkId: 7,
      phase: 'preparing',
      onAbort: vi.fn<() => void>(),
      log: vi.fn<(line: string) => void>(),
    })

    heartbeat.setPhase('investigating')
    await vi.advanceTimersByTimeAsync(30_000)
    heartbeat.stop()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(vi.mocked(api.heartbeat).mock.calls).toEqual([
      [7, { phase: 'preparing' }],
      [7, { phase: 'investigating' }],
      [7, { phase: 'investigating' }],
    ])
  })

  it('calls onAbort once when sieb answers 409', async () => {
    const onAbort = vi.fn<() => void>()
    const heartbeat = startHeartbeat({
      api: fakeApi(async () => 'abort'),
      checkId: 7,
      phase: 'investigating',
      onAbort,
      log: vi.fn<(line: string) => void>(),
    })

    await vi.advanceTimersByTimeAsync(60_000)
    heartbeat.stop()

    expect(onAbort).toHaveBeenCalledTimes(1)
  })

  it('logs failed beats and keeps beating', async () => {
    const log = vi.fn<(line: string) => void>()
    const api = fakeApi(async () => {
      throw new TypeError('fetch failed')
    })
    const heartbeat = startHeartbeat({
      api,
      checkId: 7,
      phase: 'preparing',
      onAbort: vi.fn<() => void>(),
      log,
    })

    await vi.advanceTimersByTimeAsync(30_000)
    heartbeat.stop()

    expect(api.heartbeat).toHaveBeenCalledTimes(2)
    expect(log).toHaveBeenCalledWith('[sieb-checker] heartbeat of check 7 failed: fetch failed')
  })
})
