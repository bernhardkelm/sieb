import type { ValidationIssue } from '#core/apiTypes.ts'
import { MAX_CHECK_IMAGES } from '#core/checkLimits.ts'
import { isImageDigest } from '#core/checkPrompt.ts'

/** Pulled digests of a worker result, the primary one also on its own */
export interface PulledDigests {
  pulledDigest: string | null
  pulledDigests: string[] // primary first, empty when the worker reported none
}

/**
 * Reads the optional digest of the primary image the worker exported.
 * @param {unknown} value - Raw value
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {string | null} - Digest, null when absent or invalid
 */
const readPulledDigest = (value: unknown, errors: ValidationIssue[]): string | null => {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== 'string' || !isImageDigest(value)) {
    errors.push({ field: 'pulledDigest', code: 'invalid' })
    return null
  }

  return value
}

/**
 * Reads the optional digest list of a worker result, distinct and cut to MAX_CHECK_IMAGES.
 * @param {unknown} value - Raw value
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {string[] | null} - Digests, null when absent or invalid
 */
const readDigestList = (value: unknown, errors: ValidationIssue[]): string[] | null => {
  if (value === undefined || value === null) {
    return null
  }

  if (
    !Array.isArray(value) ||
    !value.every((digest) => typeof digest === 'string' && isImageDigest(digest))
  ) {
    errors.push({ field: 'pulledDigests', code: 'invalid' })
    return null
  }

  return [...new Set(value as string[])].slice(0, MAX_CHECK_IMAGES)
}

/**
 * Reads pulledDigest and pulledDigests of a worker result. An older worker sends only
 * pulledDigest, which then makes up the list; a list must start with pulledDigest when both
 * are present.
 * @param {Record<string, unknown>} raw - Parsed request body
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {PulledDigests} - Primary digest and the list
 */
export const readPulledDigests = (
  raw: Record<string, unknown>,
  errors: ValidationIssue[],
): PulledDigests => {
  const single = readPulledDigest(raw.pulledDigest, errors)
  const list = readDigestList(raw.pulledDigests, errors)

  if (list === null) {
    return { pulledDigest: single, pulledDigests: single === null ? [] : [single] }
  }

  if (single !== null && list.length > 0 && list[0] !== single) {
    errors.push({ field: 'pulledDigests', code: 'invalid' })
  }

  return { pulledDigest: single ?? list[0] ?? null, pulledDigests: list }
}
