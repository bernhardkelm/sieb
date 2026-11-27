import type { WorkerClaim } from '#core/check.ts'
import { MAX_CHECK_MAX_TURNS, MAX_CHECK_TIMEOUT_SECONDS } from '#core/checkLimits.ts'
import { isImageDigest } from '#core/checkPrompt.ts'
import { digestOfRef, isPinnedRef } from '#checker/workspace/imageRef.ts'

// no leading dash, so the reference cannot be read as a crane flag
const IMAGE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\-/:@+]{0,511}$/
const TOKEN_PATTERN = /^[\x21-\x7e]{1,512}$/
const PROMPT_MAX_LENGTH = 100_000
const VULN_ID_MAX_LENGTH = 200

/** A claim with an invalid field, the check is reported as failed when its id is known */
export class InvalidClaimError extends Error {
  readonly checkId: number | null

  /**
   * Creates the error for the first invalid field.
   * @param {string} field - Field name
   * @param {number | null} checkId - Id of the claimed check, null when it is invalid itself
   * @returns {void}
   */
  constructor(field: string, checkId: number | null) {
    super(`invalid claim: ${field}`)
    this.name = 'InvalidClaimError'
    this.checkId = checkId
  }
}

/**
 * Returns whether a value is a positive integer up to a limit.
 * @param {unknown} value - Value
 * @param {number} max - Largest allowed value
 * @returns {boolean} - Whether it is an integer between 1 and max
 */
const isPositiveInt = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max

/**
 * Returns whether a value is an http or https URL.
 * @param {unknown} value - Value
 * @returns {boolean} - Whether it parses as an http(s) URL
 */
const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false
  }

  try {
    const url = new URL(value)

    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Returns whether the image reference is valid and pinned by a tag or a valid digest, so crane
 * never falls back to latest.
 * @param {Record<string, unknown>} claim - Raw claim
 * @returns {boolean} - Whether imageRef is acceptable
 */
const isPinnedImage = (claim: Record<string, unknown>): boolean => {
  const ref = claim.imageRef

  if (typeof ref !== 'string' || !IMAGE_REF_PATTERN.test(ref) || !isPinnedRef(ref)) {
    return false
  }

  const refDigest = digestOfRef(ref)

  return refDigest === null || isImageDigest(refDigest)
}

/**
 * Returns whether the scanned digest is absent or valid and matches a digest in the reference.
 * @param {Record<string, unknown>} claim - Raw claim
 * @returns {boolean} - Whether imageDigest is acceptable
 */
const isScannedDigest = (claim: Record<string, unknown>): boolean => {
  const digest = claim.imageDigest

  if (digest === null || digest === undefined) {
    return true
  }

  if (typeof digest !== 'string' || !isImageDigest(digest)) {
    return false
  }

  const refDigest = typeof claim.imageRef === 'string' ? digestOfRef(claim.imageRef) : null

  return refDigest === null || refDigest === digest
}

/**
 * Validates a claim answer before any of its values reach a command line or a file.
 * @param {unknown} body - Parsed JSON body of POST /worker/claim
 * @returns {WorkerClaim} - The claim
 * @throws {InvalidClaimError} - Naming the first invalid field
 */
export const parseClaim = (body: unknown): WorkerClaim => {
  const claim = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const checks: [keyof WorkerClaim, boolean][] = [
    ['checkId', isPositiveInt(claim.checkId, Number.MAX_SAFE_INTEGER)],
    ['findingId', isPositiveInt(claim.findingId, Number.MAX_SAFE_INTEGER)],
    [
      'vulnId',
      typeof claim.vulnId === 'string' &&
        claim.vulnId.length > 0 &&
        claim.vulnId.length <= VULN_ID_MAX_LENGTH,
    ],
    ['imageRef', isPinnedImage(claim)],
    ['imageDigest', isScannedDigest(claim)],
    [
      'prompt',
      typeof claim.prompt === 'string' &&
        claim.prompt.trim() !== '' &&
        claim.prompt.length <= PROMPT_MAX_LENGTH,
    ],
    ['mcpUrl', isHttpUrl(claim.mcpUrl)],
    ['token', typeof claim.token === 'string' && TOKEN_PATTERN.test(claim.token)],
    ['timeoutSeconds', isPositiveInt(claim.timeoutSeconds, MAX_CHECK_TIMEOUT_SECONDS)],
    ['maxTurns', isPositiveInt(claim.maxTurns, MAX_CHECK_MAX_TURNS)],
  ]
  const invalid = checks.find(([, valid]) => !valid)

  if (invalid) {
    const checkId = isPositiveInt(claim.checkId, Number.MAX_SAFE_INTEGER) ? claim.checkId : null

    throw new InvalidClaimError(invalid[0], checkId)
  }

  return {
    ...(claim as unknown as WorkerClaim),
    imageDigest: (claim.imageDigest ?? null) as string | null,
  }
}

/**
 * Parses the text of a claim answer. A body that is not JSON still names the check id when it
 * contains one, so the worker can fail that check instead of leaving it running until timeout.
 * @param {string} text - Body of a 200 claim answer
 * @returns {WorkerClaim} - The claim
 * @throws {InvalidClaimError} - For a body that is no JSON or an invalid claim
 */
export const parseClaimText = (text: string): WorkerClaim => {
  let body: unknown

  try {
    body = JSON.parse(text)
  } catch {
    const id = /"checkId"\s*:\s*(\d{1,15})\b/.exec(text)?.[1]

    throw new InvalidClaimError('body is no JSON', id === undefined ? null : Number(id))
  }

  return parseClaim(body)
}
