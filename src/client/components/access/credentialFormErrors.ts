import { ApiError } from '@/api/ApiError'
import { errorMessage } from '@/api/apiRequest'
import { MAX_CREDENTIAL_LABEL_LENGTH } from '#core/credentialFieldReaders.ts'
import { errorCodeMessage } from '@/format/labels'

export const CREDENTIAL_FIELDS = [
  'provider',
  'label',
  'uses',
  'registryHost',
  'gitHost',
  'pathPrefix',
  'repoMapping',
  'username',
  'secret',
] as const

export type CredentialField = (typeof CREDENTIAL_FIELDS)[number]

/** Messages per form field plus those about the whole input */
export type CredentialFormErrors = Record<CredentialField | 'general', string[]>

const CODE_MESSAGES: Record<string, string> = {
  required: 'Required.',
  too_long: 'Too long.',
  invalid: 'Not a valid value.',
  not_allowed: 'This provider does not allow it.',
  not_found: 'This credential no longer exists.',
  credentials_disabled: 'Credentials are switched off on this server.',
  duplicate_scope: 'Another credential already covers these hosts with this path prefix.',
  too_many_credentials: 'sieb holds no more credentials, delete one first.',
  secret_unreadable: 'The stored token cannot be opened, enter it again.',
  secret_required:
    'Enter the token again to change the provider or a host, it never goes to a new host unasked.',
  outside_scope: 'Keep both prefixes within the hosts and path prefix of this credential.',
  test_cooldown: 'A test ran a moment ago, try again in a few seconds.',
  test_failed: 'Not saved: the test of the token failed.',
  nothing_to_test: 'Not saved: the path prefix covers no image or repository sieb has seen.',
  untestable: 'Not saved: sieb cannot test these hosts, confirm saving without a test.',
  tests_busy: 'Other credential tests are running, try again in a moment.',
}

const LABEL_MESSAGES: Record<string, string> = {
  too_long: `At most ${MAX_CREDENTIAL_LABEL_LENGTH} characters.`,
}

/**
 * Returns a displayable message for a failed credential request, the readable text of the
 * credential error codes.
 * @param {unknown} error - Thrown value
 * @returns {string} - Message
 */
export const credentialErrorMessage = (error: unknown): string =>
  (error instanceof ApiError ? CODE_MESSAGES[error.code] : undefined) ?? errorMessage(error)

/**
 * Returns the message of a validation or error code.
 * @param {string} code - Code
 * @returns {string} - Message
 */
const codeMessage = (code: string): string => CODE_MESSAGES[code] ?? errorCodeMessage(code)

/**
 * Returns empty messages for every field.
 * @returns {CredentialFormErrors} - No messages
 */
export const noCredentialErrors = (): CredentialFormErrors => ({
  provider: [],
  label: [],
  uses: [],
  registryHost: [],
  gitHost: [],
  pathPrefix: [],
  repoMapping: [],
  username: [],
  secret: [],
  general: [],
})

/**
 * Returns the form field an API field belongs to; nested mapping fields go to the mapping.
 * @param {string | null} field - API field name, null for the whole input
 * @returns {CredentialField | 'general'} - Form field
 */
const formFieldOf = (field: string | null): CredentialField | 'general' => {
  const root = field?.split('.')[0] ?? null

  return (CREDENTIAL_FIELDS as readonly (string | null)[]).includes(root)
    ? (root as CredentialField)
    : 'general'
}

/**
 * Sorts the error of a failed save into messages per form field, every other failure becomes
 * a general message.
 * @param {unknown} error - Thrown value
 * @returns {CredentialFormErrors} - Messages per field
 */
export const credentialFormErrors = (error: unknown): CredentialFormErrors => {
  const errors = noCredentialErrors()

  if (!(error instanceof ApiError)) {
    errors.general.push(errorMessage(error))
    return errors
  }

  if (error.code === 'duplicate_scope') {
    errors.pathPrefix.push(credentialErrorMessage(error))
    return errors
  }

  if (error.code === 'secret_required') {
    errors.secret.push(credentialErrorMessage(error))
    return errors
  }

  if (!error.isValidation) {
    errors.general.push(credentialErrorMessage(error))
    return errors
  }

  for (const issue of error.errors) {
    const field = formFieldOf(issue.field)

    errors[field].push(
      (field === 'label' ? LABEL_MESSAGES[issue.code] : undefined) ?? codeMessage(issue.code),
    )
  }

  return errors
}

/**
 * Merges the messages of two error sets field by field.
 * @param {CredentialFormErrors} first - Messages
 * @param {CredentialFormErrors} second - More messages
 * @returns {CredentialFormErrors} - Both
 */
export const mergeCredentialErrors = (
  first: CredentialFormErrors,
  second: CredentialFormErrors,
): CredentialFormErrors => {
  const merged = noCredentialErrors()

  for (const field of Object.keys(merged) as (keyof CredentialFormErrors)[]) {
    merged[field] = [...first[field], ...second[field]]
  }

  return merged
}
