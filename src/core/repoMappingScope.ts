import type { CredentialFields } from '#core/credentialInputValidation.ts'
import { normalizeHostPrefix } from '#core/credentialHosts.ts'
import type { ValidationIssue } from '#core/errorApiTypes.ts'
import { prefixCovers } from '#core/imageRefParts.ts'
import { normalizeHost, PROVIDER_SPECS } from '#core/privateAccess.ts'

/**
 * Returns whether a host/path prefix lies on a host and within a path prefix.
 * @param {string} text - Normalised host/path prefix of the mapping
 * @param {string | null | true} host - Host it must lie on, true for any host, null when there is none
 * @param {string} pathPrefix - Path prefix of the credential
 * @returns {boolean} - True when the prefix is on the host and covered by the path prefix
 */
const withinScope = (text: string, host: string | null | true, pathPrefix: string): boolean => {
  const prefix = normalizeHostPrefix(text)

  return (
    prefix !== null &&
    host !== null &&
    (host === true || normalizeHost(prefix.host) === normalizeHost(host)) &&
    prefixCovers(pathPrefix, prefix.path)
  )
}

/**
 * Returns the git host a mapping of the credential may lead to: its own git host, else the
 * provider's git host, else for a self-hosted instance without git use the host the mapping
 * names, since sieb does not know that instance's git host.
 * @param {CredentialFields} fields - Validated fields of the credential
 * @returns {string | null | true} - Host, true for any host, null when the provider has no git
 */
const gitHostOf = (fields: CredentialFields): string | null | true => {
  const spec = PROVIDER_SPECS[fields.provider]

  if (fields.uses.includes('git')) {
    return fields.gitHost
  }

  return spec.customHost && fields.registryHost !== spec.registryHost ? true : spec.gitHost
}

/**
 * Checks that a repository mapping stays within its own credential: the registry prefix on the
 * credential's registry host and within its path prefix, the repository prefix on the git host
 * of the same credential or provider (gitHostOf) and within the same path prefix.
 * So a mapping only ever applies to images the credential itself covers and leads to
 * repositories of the same owner.
 * @param {CredentialFields} fields - Validated fields of the credential
 * @returns {ValidationIssue[]} - outside_scope per prefix that leaves the credential, empty when it fits or there is no mapping
 */
export const repoMappingIssues = (fields: CredentialFields): ValidationIssue[] => {
  const { repoMapping, pathPrefix } = fields

  if (repoMapping === null) {
    return []
  }

  const registryHost = fields.uses.includes('registry') ? fields.registryHost : null
  const issues: ValidationIssue[] = []

  if (!withinScope(repoMapping.registryPrefix, registryHost, pathPrefix)) {
    issues.push({ field: 'repoMapping.registryPrefix', code: 'outside_scope' })
  }

  if (!withinScope(repoMapping.repoPrefix, gitHostOf(fields), pathPrefix)) {
    issues.push({ field: 'repoMapping.repoPrefix', code: 'outside_scope' })
  }

  return issues
}
