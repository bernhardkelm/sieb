/** Why a credential test may not start now */
export type TestRefusal = 'test_cooldown' | 'tests_busy'

/** Limits of credential tests, kept in memory */
export interface TestThrottle {
  start: (id: number) => TestRefusal | null // null when the test may run, then call end
  end: (id: number, ran: boolean) => void // ran false gives back the cooldown of a test that did not run
}

export const TEST_COOLDOWN_MS = 30_000
export const MAX_RUNNING_TESTS = 3

/**
 * Creates the throttle of the credential test: one test per credential at a time and at most
 * one start per TEST_COOLDOWN_MS, and at most MAX_RUNNING_TESTS tests at once, so no user can
 * make sieb send a stream of requests to the registries and git hosts.
 * @param {() => number} now - Milliseconds of the clock
 * @param {{ cooldownMs?: number; maxRunning?: number }} limits - Limits, shorter in tests
 * @returns {TestThrottle} - Start and end calls
 */
export const createTestThrottle = (
  now: () => number,
  { cooldownMs = TEST_COOLDOWN_MS, maxRunning = MAX_RUNNING_TESTS } = {},
): TestThrottle => {
  const started = new Map<number, number>()
  const running = new Set<number>()

  return {
    start: (id) => {
      const last = started.get(id)

      if (running.has(id) || (last !== undefined && now() - last < cooldownMs)) {
        return 'test_cooldown'
      }

      if (running.size >= maxRunning) {
        return 'tests_busy'
      }

      started.set(id, now())
      running.add(id)
      return null
    },
    end: (id, ran) => {
      running.delete(id)

      if (!ran) {
        started.delete(id)
      }
    },
  }
}
