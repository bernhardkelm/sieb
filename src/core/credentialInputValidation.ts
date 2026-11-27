import {
  MAX_CREDENTIAL_SECRET_LENGTH,
  MAX_CREDENTIAL_USERNAME_LENGTH,
  readHost,
  readLabel,
  readRepoMapping,
  readTokenText,
} from '#core/credentialFieldReaders.ts'
import { normalizePathPrefix } from '#core/credentialHosts.ts'
import type { ValidationIssue } from '#core/errorApiTypes.ts'
import {
  ACCESS_PROVIDERS,
  ACCESS_USES,
  PROVIDER_SPECS,
  type AccessCredentialView,
  type AccessProvider,
  type AccessUse,
  type ProviderSpec,
} from '#core/privateAccess.ts'
import { repoMappingIssues } from '#core/repoMappingScope.ts'
import type { Validation } from '#core/validation.ts'

/** Stored fields of a credential, everything but the secret */
export type CredentialFields = Pick<
  AccessCredentialView,
  | 'provider'
  | 'label'
  | 'uses'
  | 'registryHost'
  | 'gitHost'
  | 'pathPrefix'
  | 'repoMapping'
  | 'username'
>

/** A validated create or update: the fields and the secret, null keeping the stored one */
export interface CredentialWrite {
  fields: CredentialFields
  secret: string | null
}

/**
 * Reads the uses: a non-empty list of distinct uses the provider supports.
 * @param {unknown} value - Raw value
 * @param {ProviderSpec} spec - Provider rules
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {AccessUse[]} - Uses in ACCESS_USES order, empty when invalid
 */
const readUses = (value: unknown, spec: ProviderSpec, errors: ValidationIssue[]): AccessUse[] => {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({
      field: 'uses',
      code: Array.isArray(value) || value === undefined ? 'required' : 'invalid',
    })
    return []
  }

  if (!value.every((use) => (ACCESS_USES as readonly unknown[]).includes(use))) {
    errors.push({ field: 'uses', code: 'invalid' })
    return []
  }

  if (!value.every((use: AccessUse) => spec.uses.includes(use))) {
    errors.push({ field: 'uses', code: 'not_allowed' })
    return []
  }

  return ACCESS_USES.filter((use) => value.includes(use))
}

/**
 * Validates the body of POST /api/credentials, or of PATCH merged over the stored fields: the
 * provider decides the allowed uses, the default hosts, whether custom hosts are allowed and
 * whether a username is required. A host is stored only for a use the credential has, and a
 * repository mapping must stay within the credential's own hosts and path prefix.
 * @param {Record<string, unknown>} raw - Parsed request body
 * @param {boolean} requireSecret - True on create, false on update where a missing secret keeps the stored one
 * @returns {Validation<CredentialWrite>} - Normalised fields and secret, or the errors
 */
export const validateCredentialInput = (
  raw: Record<string, unknown>,
  requireSecret: boolean,
): Validation<CredentialWrite> => {
  const errors: ValidationIssue[] = []

  if (!(ACCESS_PROVIDERS as readonly unknown[]).includes(raw.provider)) {
    return {
      ok: false,
      errors: [{ field: 'provider', code: raw.provider === undefined ? 'required' : 'invalid' }],
    }
  }

  const provider = raw.provider as AccessProvider
  const spec = PROVIDER_SPECS[provider]
  const label = readLabel(raw.label, errors)
  const uses = readUses(raw.uses, spec, errors)
  const registryHost = uses.includes('registry')
    ? readHost(raw.registryHost, spec.registryHost, spec, 'registryHost', errors)
    : null
  const gitHost = uses.includes('git')
    ? readHost(raw.gitHost, spec.gitHost, spec, 'gitHost', errors)
    : null
  const pathPrefix = typeof raw.pathPrefix === 'string' ? normalizePathPrefix(raw.pathPrefix) : null
  const repoMapping = readRepoMapping(raw.repoMapping, errors)
  const username = readTokenText(
    raw.username,
    { field: 'username', required: spec.needsUsername, max: MAX_CREDENTIAL_USERNAME_LENGTH },
    errors,
  )
  const secret = readTokenText(
    raw.secret,
    { field: 'secret', required: requireSecret, max: MAX_CREDENTIAL_SECRET_LENGTH },
    errors,
  )

  if (pathPrefix === null) {
    errors.push({
      field: 'pathPrefix',
      code: raw.pathPrefix === undefined ? 'required' : 'invalid',
    })
  }

  if (errors.length > 0 || pathPrefix === null) {
    return { ok: false, errors }
  }

  const fields = { provider, label, uses, registryHost, gitHost, pathPrefix, repoMapping, username }
  const mappingErrors = repoMappingIssues(fields)

  return mappingErrors.length > 0
    ? { ok: false, errors: mappingErrors }
    : { ok: true, value: { fields, secret } }
}
