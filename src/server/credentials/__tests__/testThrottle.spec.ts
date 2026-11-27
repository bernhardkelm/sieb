// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { createTestThrottle, TEST_COOLDOWN_MS } from '#server/credentials/testThrottle.ts'

describe('createTestThrottle', () => {
  it('allows one test per credential per cooldown and gives it back for a test that did not run', () => {
    let now = 0
    const throttle = createTestThrottle(() => now)

    expect(throttle.start(1)).toBeNull()
    expect(throttle.start(1)).toBe('test_cooldown')
    throttle.end(1, true)
    expect(throttle.start(1)).toBe('test_cooldown')
    now += TEST_COOLDOWN_MS
    expect(throttle.start(1)).toBeNull()
    throttle.end(1, false)
    expect(throttle.start(1)).toBeNull()
  })

  it('runs at most the given number of tests at once', () => {
    const throttle = createTestThrottle(() => 0, { maxRunning: 2 })

    expect(throttle.start(1)).toBeNull()
    expect(throttle.start(2)).toBeNull()
    expect(throttle.start(3)).toBe('tests_busy')
    throttle.end(1, true)
    expect(throttle.start(3)).toBeNull()
  })
})
