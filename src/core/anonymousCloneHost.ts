import type { AccessScope } from '#core/accessScope.ts'
import { isInternalHostName } from '#core/internalHostNames.ts'
import { normalizeHost, PROVIDER_SPECS } from '#core/privateAccess.ts'

const PUBLIC_GIT_HOSTS = Object.values(PROVIDER_SPECS)
  .map((spec) => spec.gitHost)
  .filter((host) => host !== null)

/**
 * Returns whether a label's repository may be cloned without a login: only on github.com,
 * gitlab.com or the git host of a stored credential, never on an internal name, so a label
 * cannot point the fetcher at an arbitrary or in-cluster host.
 * @param {readonly AccessScope[]} scopes - Usable credentials
 * @param {string} host - Git host of the label
 * @returns {boolean} - True when an anonymous clone may go there
 */
export const anonymousHost = (scopes: readonly AccessScope[], host: string): boolean =>
  !isInternalHostName(host) &&
  (PUBLIC_GIT_HOSTS.includes(host) ||
    scopes.some((scope) => scope.gitHost !== null && normalizeHost(scope.gitHost) === host))
