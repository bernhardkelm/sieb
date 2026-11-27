import { prefixCovers, splitImageRef } from '#core/imageRefParts.ts'
import { normalizeHost, type AccessCredentialView, type AccessUse } from '#core/privateAccess.ts'

/** What decides which targets a credential covers, without its secret */
export type AccessScope = Pick<
  AccessCredentialView,
  'id' | 'label' | 'uses' | 'registryHost' | 'gitHost' | 'pathPrefix' | 'repoMapping'
>

/**
 * Returns the host a credential uses for one purpose.
 * @param {AccessScope} scope - Credential scope
 * @param {AccessUse} use - registry or git
 * @returns {string | null} - Host, null when the credential lacks the use
 */
const hostFor = (scope: AccessScope, use: AccessUse): string | null => {
  if (!scope.uses.includes(use)) {
    return null
  }

  return use === 'registry' ? scope.registryHost : scope.gitHost
}

/**
 * Returns the credential of one use that covers a host and path, the longest path prefix
 * winning and the lower id on a tie.
 * @param {readonly AccessScope[]} scopes - Usable credentials
 * @param {AccessUse} use - registry or git
 * @param {string} host - Target host
 * @param {string} path - Target path without leading slash, lower case
 * @returns {AccessScope | null} - Covering credential, null when none covers the target
 */
export const coveringScope = (
  scopes: readonly AccessScope[],
  use: AccessUse,
  host: string,
  path: string,
): AccessScope | null => {
  let best: AccessScope | null = null

  for (const scope of scopes) {
    const scopeHost = hostFor(scope, use)

    if (scopeHost === null || normalizeHost(scopeHost) !== normalizeHost(host)) {
      continue
    }

    if (!prefixCovers(scope.pathPrefix, path)) {
      continue
    }

    if (
      best === null ||
      scope.pathPrefix.length > best.pathPrefix.length ||
      (scope.pathPrefix.length === best.pathPrefix.length && scope.id < best.id)
    ) {
      best = scope
    }
  }

  return best
}

/**
 * Returns the registry credential that covers an image.
 * @param {readonly AccessScope[]} scopes - Usable credentials
 * @param {string} imageRef - Image ref of a finding
 * @returns {AccessScope | null} - Covering credential, null when none covers the image
 */
export const registryScopeFor = (
  scopes: readonly AccessScope[],
  imageRef: string,
): AccessScope | null => {
  const parts = splitImageRef(imageRef)

  return parts === null ? null : coveringScope(scopes, 'registry', parts.host, parts.path)
}

/**
 * Returns whether two scopes claim the same host and path prefix for a shared use, which
 * would leave the longest prefix rule without a winner.
 * @param {AccessScope} a - Scope
 * @param {AccessScope} b - Scope
 * @returns {boolean} - True when they collide
 */
export const scopesCollide = (a: AccessScope, b: AccessScope): boolean =>
  a.pathPrefix === b.pathPrefix &&
  (['registry', 'git'] as const).some((use) => {
    const hostA = hostFor(a, use)
    const hostB = hostFor(b, use)

    return hostA !== null && hostB !== null && normalizeHost(hostA) === normalizeHost(hostB)
  })
