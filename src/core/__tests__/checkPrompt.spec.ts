import { describe, expect, it } from 'vitest'

import {
  capText,
  checkTimeoutError,
  HEARTBEAT_INTERVAL_MS,
  MAX_WORKER_POLL_SECONDS,
  textLength,
  WORKER_ONLINE_MS,
} from '#core/checkLimits.ts'
import { checkPullRef, isImageDigest } from '#core/checkPrompt.ts'

const IMAGE = 'ghcr.io/example/app'
const DIGEST = `sha256:${'c'.repeat(64)}`

/**
 * Builds an instance with the fields the pull ref reads.
 * @param {Partial<Parameters<typeof checkPullRef>[1][number]>} overrides - Fields to set
 * @returns {Parameters<typeof checkPullRef>[1][number]} - Instance
 */
const instance = (overrides: Partial<Parameters<typeof checkPullRef>[1][number]> = {}) => ({
  id: 1,
  imageTag: null,
  imageDigest: null,
  lastSeen: '2026-06-01T00:00:00.000Z',
  resolvedAt: null,
  ...overrides,
})

describe('checkPullRef', () => {
  it('prefers the digest of the most recently seen open instance', () => {
    expect(
      checkPullRef(IMAGE, [
        instance({ id: 1, imageTag: '1.0', lastSeen: '2026-06-02T00:00:00.000Z' }),
        instance({ id: 2, imageDigest: DIGEST }),
      ]),
    ).toEqual({ imageRef: `${IMAGE}@${DIGEST}`, imageDigest: DIGEST })
  })

  it('pulls by tag without a digest and says so with imageDigest null', () => {
    expect(checkPullRef(IMAGE, [instance({ imageTag: '1.0' })])).toEqual({
      imageRef: `${IMAGE}:1.0`,
      imageDigest: null,
    })
  })

  it('never falls back to the bare ref, which would pull latest', () => {
    expect(
      checkPullRef(IMAGE, [
        instance({ imageDigest: DIGEST, resolvedAt: 't' }),
        instance({ id: 2, imageTag: '1.0 ; rm -rf /', imageDigest: 'sha256:xyz' }),
      ]),
    ).toBeNull()
    expect(checkPullRef(IMAGE, [])).toBeNull()
  })
})

describe('isImageDigest', () => {
  it('accepts algorithm and hex and refuses other text and overlong values', () => {
    expect(isImageDigest(DIGEST)).toBe(true)
    expect(isImageDigest('sha256:xyz')).toBe(false)
    expect(isImageDigest(`${DIGEST}\n`)).toBe(false)
    expect(isImageDigest(`sha256:${'a'.repeat(200)}`)).toBe(false)
  })
})

describe('shared check limits', () => {
  it('counts and cuts text in code points, never splitting a surrogate pair', () => {
    expect(textLength('a😀b')).toBe(3)
    expect(capText('😀😀😀', 2)).toBe('😀😀')
    expect(capText('short', 10)).toBe('short')
  })

  it('keeps the worker online across heartbeats and the longest idle poll', () => {
    expect(WORKER_ONLINE_MS).toBe(90_000)
    expect(WORKER_ONLINE_MS).toBeGreaterThan(2 * HEARTBEAT_INTERVAL_MS)
    expect(WORKER_ONLINE_MS).toBeGreaterThan(MAX_WORKER_POLL_SECONDS * 1000)
  })
})

describe('checkTimeoutError', () => {
  const started = '2026-06-01T12:00:00.000Z'
  const at = (seconds: number): Date => new Date(Date.parse(started) + seconds * 1000)

  it('allows two minutes between heartbeats and a minute past the timeout', () => {
    expect(checkTimeoutError({ startedAt: started, heartbeatAt: started }, at(120), 600)).toBeNull()
    expect(checkTimeoutError({ startedAt: started, heartbeatAt: started }, at(121), 600)).toMatch(
      /heartbeat/,
    )
    expect(
      checkTimeoutError({ startedAt: started, heartbeatAt: at(650).toISOString() }, at(661), 600),
    ).toMatch(/600 seconds/)
  })
})
