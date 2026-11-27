import { testVerdict, type AccessTestRefusalCode } from '#core/accessTestVerdict.ts'
import type { AccessTestResult } from '#core/privateAccess.ts'
import { testCandidate, type CredentialCandidate } from '#server/credentials/candidateTest.ts'
import type { CredentialContext } from '#server/credentials/credentialContext.ts'
import type { CredentialVault } from '#server/credentials/credentialVault.ts'
import { createRecentTests } from '#server/credentials/recentTests.ts'
import {
  TEST_COOLDOWN_MS,
  type TestRefusal,
  type TestThrottle,
} from '#server/credentials/testThrottle.ts'

/** A test the throttle did not start, 429 */
export interface ThrottledTest {
  ok: false
  throttled: TestRefusal
}

/** A save the test refused, 422 with the result */
export interface RefusedSave {
  ok: false
  refused: AccessTestRefusalCode
  result: AccessTestResult
}

/** A test that ran or was recalled */
export interface RanTest {
  ok: true
  result: AccessTestResult
}

/** Tests of entered values, throttled per user and overall */
export interface CredentialTestGate {
  dryRun: (actor: string, candidate: CredentialCandidate) => Promise<RanTest | ThrottledTest> // tests without storing anything
  beforeStore: (
    actor: string,
    candidate: CredentialCandidate,
    confirmUntested: boolean,
  ) => Promise<RanTest | ThrottledTest | RefusedSave> // the result to store as lastTest, or why the save may not happen
  stored: (actor: string) => void // drops the remembered test once its values are stored
}

/**
 * Creates the gate that tests entered values before they are stored. A user runs one such test
 * at a time and starts at most one per cooldown; a save of the same values right after a test
 * reuses its result instead of a second run. A save passes when testVerdict passes, or when
 * every target is on an address sieb may not reach and the user confirmed it, then the result
 * records untested.
 * @param {CredentialContext} context - Database, clock, fetch and limits
 * @param {CredentialVault} vault - Vault of the configured key
 * @param {TestThrottle} throttle - Throttle shared with the tests of stored credentials
 * @returns {CredentialTestGate} - Dry run, test before a store and forget calls
 */
export const createCredentialTestGate = (
  context: CredentialContext,
  vault: CredentialVault,
  throttle: TestThrottle,
): CredentialTestGate => {
  const recent = createRecentTests(
    () => context.clock().getTime(),
    context.testLimits?.cooldownMs ?? TEST_COOLDOWN_MS,
  )

  /**
   * Recalls or runs the test of entered values.
   * @param {string} actor - Acting user
   * @param {CredentialCandidate} candidate - Values and secret
   * @returns {Promise<RanTest | ThrottledTest>} - Result, or the throttle's refusal
   */
  const run = async (
    actor: string,
    candidate: CredentialCandidate,
  ): Promise<RanTest | ThrottledTest> => {
    const recalled = recent.recall(actor, candidate)

    if (recalled !== null) {
      return { ok: true, result: recalled }
    }

    const key = `user:${actor}` as const
    const refusal = throttle.start(key)

    if (refusal !== null) {
      return { ok: false, throttled: refusal }
    }

    try {
      const result = await testCandidate(context, vault, candidate)

      recent.remember(actor, candidate, result)
      return { ok: true, result }
    } finally {
      throttle.end(key, true)
    }
  }

  return {
    dryRun: run,
    beforeStore: async (actor, candidate, confirmUntested) => {
      const tested = await run(actor, candidate)

      if (!tested.ok) {
        return tested
      }

      const verdict = testVerdict(tested.result)

      if (verdict === 'passed') {
        return tested
      }

      if (verdict === 'untestable' && confirmUntested) {
        return { ok: true, result: { ...tested.result, untested: true } }
      }

      return { ok: false, refused: verdict, result: tested.result }
    },
    stored: (actor) => recent.forget(actor),
  }
}
