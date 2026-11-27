import type { ValidationIssue } from '#core/errorApiTypes.ts'
import type { SourceRequest } from '#core/privateAccess.ts'
import type { Validation } from '#core/validation.ts'

export const MAX_SOURCE_LABEL_LENGTH = 500
export const MAX_SOURCE_IMAGE_REF_LENGTH = 300

/**
 * Reads an optional label: null, or a trimmed string up to max characters, blank counting as null.
 * @param {unknown} value - Raw value
 * @param {string} field - Field name for the error
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {string | null} - Label, null when absent or invalid
 */
const readLabel = (value: unknown, field: string, errors: ValidationIssue[]): string | null => {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== 'string' || value.length > MAX_SOURCE_LABEL_LENGTH) {
    errors.push({ field, code: typeof value === 'string' ? 'too_long' : 'invalid' })
    return null
  }

  return value.trim() === '' ? null : value.trim()
}

/**
 * Validates the body of POST /worker/checks/:id/source: the repository of the pulled primary
 * image and its source and revision labels.
 * @param {Record<string, unknown>} raw - Parsed request body
 * @returns {Validation<SourceRequest>} - Request, or the errors
 */
export const validateSourceRequest = (raw: Record<string, unknown>): Validation<SourceRequest> => {
  const errors: ValidationIssue[] = []
  const imageRef = typeof raw.imageRef === 'string' ? raw.imageRef.trim() : ''
  const sourceLabel = readLabel(raw.sourceLabel, 'sourceLabel', errors)
  const revisionLabel = readLabel(raw.revisionLabel, 'revisionLabel', errors)

  if (imageRef === '' || imageRef.length > MAX_SOURCE_IMAGE_REF_LENGTH) {
    errors.push({ field: 'imageRef', code: raw.imageRef === undefined ? 'required' : 'invalid' })
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: { imageRef, sourceLabel, revisionLabel } }
}
