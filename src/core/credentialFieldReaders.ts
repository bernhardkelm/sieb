import { isCredentialHost, normalizeHostPrefix } from '#core/credentialHosts.ts'
import type { ValidationIssue } from '#core/errorApiTypes.ts'
import { normalizeHost, type ProviderSpec, type RepoMapping } from '#core/privateAccess.ts'

export const MAX_CREDENTIAL_LABEL_LENGTH = 64
export const MAX_CREDENTIAL_USERNAME_LENGTH = 200
export const MAX_CREDENTIAL_SECRET_LENGTH = 4096

// printable ASCII without spaces, so a value cannot smuggle a header or a second line
const TOKEN_TEXT = /^[\x21-\x7e]+$/u

/**
 * Reads the label: trimmed, 1 to MAX_CREDENTIAL_LABEL_LENGTH characters without control characters.
 * @param {unknown} value - Raw value
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {string} - Label, '' when invalid
 */
export const readLabel = (value: unknown, errors: ValidationIssue[]): string => {
  const label = typeof value === 'string' ? value.trim() : ''

  if (label === '') {
    errors.push({
      field: 'label',
      code:
        typeof value === 'string' || value === undefined || value === null ? 'required' : 'invalid',
    })
  } else if (Array.from(label).length > MAX_CREDENTIAL_LABEL_LENGTH) {
    errors.push({ field: 'label', code: 'too_long' })
  } else if (/\p{Cc}/u.test(label)) {
    errors.push({ field: 'label', code: 'invalid' })
  }

  return label
}

/**
 * Reads the host of one use: the provider's default when left out, a custom one only where
 * the provider allows self-hosted instances.
 * @param {unknown} value - Raw value
 * @param {string | null} fallback - Default host of the provider for this use
 * @param {ProviderSpec} spec - Provider rules
 * @param {string} field - Field name for the error
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {string | null} - Normalised host, null when invalid
 */
export const readHost = (
  value: unknown,
  fallback: string | null,
  spec: ProviderSpec,
  field: string,
  errors: ValidationIssue[],
): string | null => {
  if (value === undefined || value === null || value === '') {
    if (fallback === null) {
      errors.push({ field, code: 'required' })
    }

    return fallback
  }

  const host = typeof value === 'string' ? normalizeHost(value) : ''

  if (!isCredentialHost(host)) {
    errors.push({ field, code: 'invalid' })
    return null
  }

  if (!spec.customHost && host !== normalizeHost(fallback ?? '')) {
    errors.push({ field, code: 'not_allowed' })
    return null
  }

  return host
}

/**
 * Reads the optional repository mapping, both prefixes normalised to host/path.
 * @param {unknown} value - Raw value
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {RepoMapping | null} - Mapping, null when absent or invalid
 */
export const readRepoMapping = (value: unknown, errors: ValidationIssue[]): RepoMapping | null => {
  if (value === undefined || value === null) {
    return null
  }

  const raw = typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const from =
    typeof raw.registryPrefix === 'string' ? normalizeHostPrefix(raw.registryPrefix) : null
  const to = typeof raw.repoPrefix === 'string' ? normalizeHostPrefix(raw.repoPrefix) : null

  if (from === null) {
    errors.push({ field: 'repoMapping.registryPrefix', code: 'invalid' })
  }

  if (to === null || to.path === '') {
    errors.push({ field: 'repoMapping.repoPrefix', code: 'invalid' })
  }

  return from === null || to === null ? null : { registryPrefix: from.text, repoPrefix: to.text }
}

/**
 * Reads a username or secret: trimmed printable ASCII without spaces, a username also
 * without a colon, which would end it in basic auth.
 * @param {unknown} value - Raw value
 * @param {{ field: string; required: boolean; max: number }} rule - Field name, whether it is required and the longest value
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {string | null} - Value, null when absent or invalid
 */
export const readTokenText = (
  value: unknown,
  { field, required, max }: { field: string; required: boolean; max: number },
  errors: ValidationIssue[],
): string | null => {
  const text = typeof value === 'string' ? value.trim() : null

  if (text === null || text === '') {
    if (required || (value !== undefined && value !== null && typeof value !== 'string')) {
      errors.push({
        field,
        code: text === null && value !== undefined && value !== null ? 'invalid' : 'required',
      })
    }

    return null
  }

  if (text.length > max) {
    errors.push({ field, code: 'too_long' })
    return null
  }

  if (!TOKEN_TEXT.test(text) || (field === 'username' && text.includes(':'))) {
    errors.push({ field, code: 'invalid' })
    return null
  }

  return text
}
