/** Why a credential test may not start now */
export type TestRefusal = 'test_cooldown' | 'tests_busy'

/** What a test is throttled by: a stored credential's id, or user:<name> for tests of entered values */
export type TestKey = number | `user:${string}`

/** Limits of credential tests, kept in memory */
export interface TestThrottle {
  start: (key: TestKey) => TestRefusal | null // null when the test may run, then call end
  end: (key: TestKey, ran: boolean) => void // ran false gives back the cooldown of a test that did not run
}

export const TEST_COOLDOWN_MS = 10_000
export const MAX_RUNNING_TESTS = 3

/**
 * Creates the throttle of the credential test: one test per stored credential, and one per user
 * for entered values, at a time and at most one start per TEST_COOLDOWN_MS, and at most
 * MAX_RUNNING_TESTS tests at once, so no user can make sieb send a stream of requests to the
 * registries and git hosts.
 * @param {() => number} now - Milliseconds of the clock
 * @param {{ cooldownMs?: number; maxRunning?: number }} limits - Limits, shorter in tests
 * @returns {TestThrottle} - Start and end calls
 */
export const createTestThrottle = (
  now: () => number,
  { cooldownMs = TEST_COOLDOWN_MS, maxRunning = MAX_RUNNING_TESTS } = {},
): TestThrottle => {
  const started = new Map<TestKey, number>()
  const running = new Set<TestKey>()

  return {
    start: (key) => {
      const last = started.get(key)

      if (running.has(key) || (last !== undefined && now() - last < cooldownMs)) {
        return 'test_cooldown'
      }

      if (running.size >= maxRunning) {
        return 'tests_busy'
      }

      started.set(key, now())
      running.add(key)
      return null
    },
    end: (key, ran) => {
      running.delete(key)

      if (!ran) {
        started.delete(key)
      }
    },
  }
}
