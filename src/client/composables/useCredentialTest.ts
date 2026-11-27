import { computed, ref, type ComputedRef, type Ref } from 'vue'

import { testVerdict, type AccessTestVerdict } from '#core/accessTestVerdict.ts'
import type { AccessTestResult } from '#core/privateAccess.ts'
import { ApiError } from '@/api/ApiError'

/** What the form runs: the test before a save, or a test only */
export type CredentialTestPhase = 'save' | 'test'

export interface CredentialTest {
  /** Last test of the form's values, from a test only or a refused save */
  result: Ref<AccessTestResult | null>
  verdict: ComputedRef<AccessTestVerdict | null>
  /** Whether the result is that of a save the server refused */
  refused: Ref<boolean>
  /** Test running right now, null while idle */
  running: Ref<CredentialTestPhase | null>
  /** Whether the next save may store a credential sieb cannot test */
  confirmUntested: Ref<boolean>
  /** Records the outcome of a test only */
  recordTest: (result: AccessTestResult) => void
  /** Records the result of a save the test refused, returns false for any other failure */
  recordRefusal: (error: unknown) => boolean
}

const REFUSAL_CODES = new Set(['test_failed', 'nothing_to_test', 'untestable'])

/**
 * Holds the credential test of the add and edit form: the last result, whether it refused a
 * save, the test in flight and the confirmation to save untested. The confirmation resets
 * whenever a result no longer says the hosts are untestable.
 * @returns {CredentialTest} - Test state and recorders
 */
export const useCredentialTest = (): CredentialTest => {
  const result = ref<AccessTestResult | null>(null)
  const refused = ref(false)
  const running = ref<CredentialTestPhase | null>(null)
  const confirmUntested = ref(false)
  const verdict = computed(() => (result.value === null ? null : testVerdict(result.value)))

  /**
   * Stores a result and drops a confirmation that no longer applies.
   * @param {AccessTestResult} next - Test result
   * @param {boolean} fromSave - Whether a refused save answered it
   * @returns {void}
   */
  const record = (next: AccessTestResult, fromSave: boolean): void => {
    result.value = next
    refused.value = fromSave

    if (verdict.value !== 'untestable') {
      confirmUntested.value = false
    }
  }

  return {
    result,
    verdict,
    refused,
    running,
    confirmUntested,
    recordTest: (next) => record(next, false),
    recordRefusal: (error) => {
      if (!(error instanceof ApiError) || !REFUSAL_CODES.has(error.code)) {
        return false
      }

      if (error.testResult !== null) {
        record(error.testResult, true)
      }

      return error.testResult !== null
    },
  }
}
