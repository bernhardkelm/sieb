import type { AccessTestVerdict } from '#core/accessTestVerdict.ts'
import type { CredentialTestPhase } from '@/composables/useCredentialTest'

export const UNTESTED_CONFIRM_LABEL =
  'Save without a test: sieb cannot reach this host, the fetcher still can'

export const UNTESTED_NOTE =
  'Saved without a test: sieb cannot reach its hosts on private or in-cluster addresses, the fetcher still can.'

const PROGRESS: Record<CredentialTestPhase, string> = {
  save: 'Testing the token on the covered images and repositories before saving…',
  test: 'Testing the token on the covered images and repositories…',
}

const NOTHING_TO_TEST =
  'the path prefix covers no image or repository sieb has seen, so the token cannot be tested. Check the prefix.'

const OUTCOMES: Record<AccessTestVerdict, { refused: string; tested: string }> = {
  passed: {
    refused: 'The test passed.',
    tested: 'The test passed. Nothing is saved yet.',
  },
  test_failed: {
    refused: 'Not saved: the test failed. Fix the token or the prefix and try again.',
    tested: 'The test failed, saving would be refused.',
  },
  nothing_to_test: {
    refused: `Not saved: ${NOTHING_TO_TEST}`,
    tested: `Nothing to test: ${NOTHING_TO_TEST}`,
  },
  untestable: {
    refused:
      'Not saved: sieb cannot test these hosts, they are on private or in-cluster addresses. Confirm below to save without a test.',
    tested:
      'sieb cannot test these hosts, they are on private or in-cluster addresses. Saving needs the confirmation below.',
  },
}

/**
 * Returns the progress line of a running credential test.
 * @param {CredentialTestPhase} phase - Test before a save, or a test only
 * @returns {string} - Progress text
 */
export const testProgressText = (phase: CredentialTestPhase): string => PROGRESS[phase]

/**
 * Returns the headline of a credential test in the form.
 * @param {AccessTestVerdict} verdict - Verdict of the test
 * @param {boolean} refused - Whether the test refused a save, else it was a test only
 * @returns {string} - Headline
 */
export const testOutcomeText = (verdict: AccessTestVerdict, refused: boolean): string =>
  refused ? OUTCOMES[verdict].refused : OUTCOMES[verdict].tested
