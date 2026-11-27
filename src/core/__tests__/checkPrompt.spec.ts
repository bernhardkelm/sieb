import { describe, expect, it } from 'vitest'

import {
  capText,
  checkTimeoutError,
  HEARTBEAT_INTERVAL_MS,
  MAX_WORKER_POLL_SECONDS,
  textLength,
  WORKER_ONLINE_MS,
} from '#core/checkLimits.ts'
import { isImageDigest, isImageTag } from '#core/checkPrompt.ts'

const DIGEST = `sha256:${'c'.repeat(64)}`

describe('isImageDigest', () => {
  it('accepts algorithm and hex and refuses other text and overlong values', () => {
    expect(isImageDigest(DIGEST)).toBe(true)
    expect(isImageDigest('sha256:xyz')).toBe(false)
    expect(isImageDigest(`${DIGEST}\n`)).toBe(false)
    expect(isImageDigest(`sha256:${'a'.repeat(200)}`)).toBe(false)
  })
})

describe('isImageTag', () => {
  it('accepts tags that are safe as directory names only', () => {
    expect(isImageTag('17.11-trixie')).toBe(true)
    expect(isImageTag('.hidden')).toBe(false)
    expect(isImageTag('../x')).toBe(false)
    expect(isImageTag('-flag')).toBe(false)
    expect(isImageTag('a'.repeat(129))).toBe(false)
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
