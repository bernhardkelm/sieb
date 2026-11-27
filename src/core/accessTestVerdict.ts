import type {
  AccessCredentialInput,
  AccessTestPart,
  AccessTestResult,
} from '#core/privateAccess.ts'

/** Failure reasons that say the host refused the credential itself */
export const DENIED_REASONS: readonly string[] = ['401 unauthorized', '403 forbidden']

/** Failure reason of a target sieb does not test, a private or in-cluster address */
export const ADDRESS_NOT_ALLOWED = 'address not allowed'

/**
 * What a test says about storing a credential: passed, a failure, no covered target, or only
 * targets sieb may not reach, which need confirmUntested.
 */
export type AccessTestVerdict = 'passed' | 'test_failed' | 'nothing_to_test' | 'untestable'

/** Error codes of a save or edit the test refused */
export type AccessTestRefusalCode = Exclude<AccessTestVerdict, 'passed'>

/** Body of the 422 answer of a refused save, the test result without the secret */
export interface AccessTestRefusal {
  error: AccessTestRefusalCode
  result: AccessTestResult
}

/** POST /api/credentials/test body: a new credential, or { id, ...changes } of a stored one */
export type AccessCredentialTestInput = Partial<AccessCredentialInput> & { id?: number }

const SEVERITY: readonly AccessTestVerdict[] = [
  'test_failed',
  'nothing_to_test',
  'untestable',
  'passed',
]

/**
 * Counts the failures of a part with one of the reasons, from the stored count when the server
 * counted all failures, else from the capped list of older tests.
 * @param {number | undefined} counted - Count the server stored
 * @param {AccessTestPart} part - Part of a test
 * @param {(reason: string) => boolean} matches - Reasons to count
 * @returns {number} - Failures with the reason
 */
const countOf = (
  counted: number | undefined,
  part: AccessTestPart,
  matches: (reason: string) => boolean,
): number => counted ?? part.failures.filter((failure) => matches(failure.reason)).length

/**
 * Returns the verdict of one use: failed on any refused login, nothing to test without a
 * covered target, passed when one target was reachable, untestable when every target was
 * on an address sieb may not reach, failed otherwise.
 * @param {AccessTestPart} part - Part of a test
 * @returns {AccessTestVerdict} - Verdict of the use
 */
export const partVerdict = (part: AccessTestPart): AccessTestVerdict => {
  if (countOf(part.denied, part, (reason) => DENIED_REASONS.includes(reason)) > 0) {
    return 'test_failed'
  }

  if (part.checked === 0) {
    return 'nothing_to_test'
  }

  if (part.ok > 0) {
    return 'passed'
  }

  const blocked = countOf(part.blocked, part, (reason) => reason === ADDRESS_NOT_ALLOWED)

  return blocked === part.checked ? 'untestable' : 'test_failed'
}

/**
 * Returns the verdict of a test over all uses of the credential, the worst use deciding:
 * a failure, then nothing to test, then untestable.
 * @param {AccessTestResult} result - Test result
 * @returns {AccessTestVerdict} - Verdict
 */
export const testVerdict = (result: AccessTestResult): AccessTestVerdict => {
  const verdicts = [result.registry, result.git]
    .filter((part) => part !== null)
    .map((part) => partVerdict(part))

  return SEVERITY.find((verdict) => verdicts.includes(verdict)) ?? 'nothing_to_test'
}

/**
 * Returns whether a test lets sieb store the credential without a confirmation.
 * @param {AccessTestResult} result - Test result
 * @returns {boolean} - True when every use passed
 */
export const testPassed = (result: AccessTestResult): boolean => testVerdict(result) === 'passed'
