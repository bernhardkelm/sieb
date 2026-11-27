import type { ValidationIssue } from '#core/errorApiTypes.ts'
import type { CheckedSource } from '#core/privateAccess.ts'
import { commitRevision } from '#core/repositoryResolution.ts'
import { parseRepositoryUrl } from '#core/repositoryUrl.ts'

export const MAX_REPO_URL_LENGTH = 500

/**
 * Reads the optional source of a worker result: an https repository URL without credentials,
 * a commit of 7 to 64 hex digits or null, and whether the image label named the repository.
 * @param {unknown} value - Raw source
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {CheckedSource | null | undefined} - Source with the normalised URL, null for none, undefined when absent or invalid
 */
export const readCheckedSource = (
  value: unknown,
  errors: ValidationIssue[],
): CheckedSource | null | undefined => {
  if (value === undefined || value === null) {
    return value
  }

  const raw =
    typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  const url = raw.repoUrl
  const repository =
    typeof url === 'string' && url.length <= MAX_REPO_URL_LENGTH ? parseRepositoryUrl(url) : null
  const absent = raw.revision === undefined || raw.revision === null
  const revision = typeof raw.revision === 'string' ? commitRevision(raw.revision) : null

  if (repository === null || repository === 'not_https') {
    errors.push({ field: 'source.repoUrl', code: url === undefined ? 'required' : 'invalid' })
  }

  if (!absent && revision === null) {
    errors.push({ field: 'source.revision', code: 'invalid' })
  }

  if (typeof raw.fromLabel !== 'boolean') {
    errors.push({
      field: 'source.fromLabel',
      code: raw.fromLabel === undefined ? 'required' : 'invalid',
    })
  }

  if (repository === null || repository === 'not_https' || typeof raw.fromLabel !== 'boolean') {
    return undefined
  }

  return { repoUrl: repository.repoUrl, revision, fromLabel: raw.fromLabel }
}
