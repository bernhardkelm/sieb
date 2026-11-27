import {
  PROVIDER_SPECS,
  type AccessCredentialView,
  type AccessTestPart,
  type AccessTestResult,
  type AccessUse,
  type ImageCheckAccess,
} from '#core/privateAccess.ts'
import { formatCount } from '@/format/count'

export const ACCESS_USE_LABELS: Record<AccessUse, string> = {
  registry: 'Registry',
  git: 'Git',
}

export const NO_ACCESS_REASON =
  "No credential covers this image's registry. Add one on the Access page, in the user menu."

export const UNREADABLE_REASON =
  'The token cannot be opened: it was stored with another SIEB_CREDENTIALS_KEY, or the credential was changed outside sieb. Edit the credential and enter the token again.'

/**
 * Returns what a credential covers, one pattern per use.
 * @param {AccessCredentialView} credential - Credential
 * @returns {string[]} - Such as "registry.gitlab.com/your-group/*", "docker.io/*" without prefix
 */
export const coveredTargets = (credential: AccessCredentialView): string[] => {
  const trimmed = credential.pathPrefix.replace(/^\/+|\/+$/gu, '')
  const prefix = trimmed === '' ? '*' : `${trimmed}/*`
  const hosts = [
    credential.uses.includes('registry') ? credential.registryHost : null,
    credential.uses.includes('git') ? credential.gitHost : null,
  ]

  return hosts.filter((host): host is string => host !== null).map((host) => `${host}/${prefix}`)
}

/**
 * Returns the uses of a credential as words.
 * @param {readonly AccessUse[]} uses - Uses
 * @returns {string} - Such as "Registry and Git"
 */
export const usesText = (uses: readonly AccessUse[]): string =>
  uses.map((use) => ACCESS_USE_LABELS[use]).join(' and ')

/**
 * Returns the outcome of one part of a test.
 * @param {AccessTestPart} part - Counts of the part
 * @returns {string} - Such as "3 of 4 reachable"
 */
export const testPartText = (part: AccessTestPart): string =>
  part.checked === 0
    ? 'nothing to test'
    : `${formatCount(part.ok)} of ${formatCount(part.checked)} reachable`

const FAILURE_NOTES: Record<string, string> = {
  'address not allowed':
    'sieb does not test hosts on private or in-cluster addresses; the fetcher can still use them.',
}

/**
 * Returns the reason a test target failed, with an explanation where the bare reason misleads.
 * @param {string} reason - Failure reason of the test
 * @returns {string} - Reason, followed by its explanation where one is known
 */
export const testFailureText = (reason: string): string => {
  const note = FAILURE_NOTES[reason]

  return note === undefined ? reason : `${reason}. ${note}`
}

/**
 * Returns whether a test found a failure in any part.
 * @param {AccessTestResult} result - Test result
 * @returns {boolean} - True when a target was not reachable
 */
export const testFailed = (result: AccessTestResult): boolean =>
  [result.registry, result.git].some((part) => part !== null && part.ok < part.checked)

/**
 * Returns the one-line outcome of a test for the toast.
 * @param {AccessTestResult} result - Test result
 * @returns {string} - Such as "Images: 2 of 2 reachable. Repositories: 1 of 1 reachable."
 */
export const testSummaryText = (result: AccessTestResult): string => {
  const parts = [
    result.registry === null ? null : `Images: ${testPartText(result.registry)}.`,
    result.git === null ? null : `Repositories: ${testPartText(result.git)}.`,
  ]

  return parts.filter((part) => part !== null).join(' ')
}

/**
 * Returns how Auto-check reaches an image.
 * @param {ImageCheckAccess} access - Access of the image
 * @returns {string} - Public, Via <label> or No access
 */
export const checkAccessText = (access: ImageCheckAccess): string => {
  if (access.level === 'public') {
    return 'Public'
  }

  return access.level === 'credential'
    ? `Via ${access.credentialLabel ?? 'a credential'}`
    : 'No access'
}

/**
 * Returns the display name of a credential's provider.
 * @param {AccessCredentialView} credential - Credential
 * @returns {string} - Such as "GitLab"
 */
export const providerLabel = (credential: Pick<AccessCredentialView, 'provider'>): string =>
  PROVIDER_SPECS[credential.provider].label
