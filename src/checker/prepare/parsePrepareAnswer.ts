import { capText, MAX_CHECK_ERROR_LENGTH } from '#core/checkLimits.ts'
import { isImageDigest, isImageTag } from '#core/checkPrompt.ts'
import { isPlainObject } from '#core/isPlainObject.ts'
import { CheckFailure } from '#checker/CheckFailure.ts'
import {
  SOURCE_MISS_REASONS,
  type PrepareAnswer,
  type PrepareError,
  type SourceOutcome,
} from '#checker/prepare/prepareTypes.ts'
import { isCommit, repoUrlOf } from '#checker/source/sourceValues.ts'
import type { PreparedImage, SkippedImage } from '#checker/workspace/prepareWorkspace.ts'
import type { PulledImage } from '#checker/workspace/resolveImage.ts'

const IMAGE_DIR_PATTERN = /^images\/\d{1,2}-[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\-/:@+]{0,511}$/

/** The fetcher answered something the checker cannot use */
const invalid = (): CheckFailure => new CheckFailure('the fetcher sent an invalid answer')

/**
 * Returns whether a value is a pulled image as the fetcher reports it.
 * @param {unknown} value - Raw value
 * @returns {boolean} - Whether ref, digest, tag and claim reference are acceptable
 */
const isPulled = (value: unknown): value is PulledImage => {
  if (!isPlainObject(value)) {
    return false
  }

  const { ref, digest, scanned, tag, claimRef } = value

  return (
    typeof ref === 'string' &&
    REF_PATTERN.test(ref) &&
    typeof digest === 'string' &&
    isImageDigest(digest) &&
    ref.endsWith(`@${digest}`) &&
    typeof scanned === 'boolean' &&
    (tag === null || (typeof tag === 'string' && isImageTag(tag))) &&
    typeof claimRef === 'string' &&
    REF_PATTERN.test(claimRef)
  )
}

/**
 * Returns whether a value is a prepared image with a directory below images/.
 * @param {unknown} value - Raw value
 * @returns {boolean} - Whether it is a pulled image with a valid directory
 */
const isPrepared = (value: unknown): value is PreparedImage =>
  isPlainObject(value) &&
  isPulled(value) &&
  typeof value.dir === 'string' &&
  IMAGE_DIR_PATTERN.test(value.dir)

/**
 * Returns whether a value is a skipped image with a known reason.
 * @param {unknown} value - Raw value
 * @returns {boolean} - Whether image and reason are acceptable
 */
const isSkipped = (value: unknown): value is SkippedImage =>
  isPlainObject(value) &&
  isPulled(value.image) &&
  (value.reason === 'size' || value.reason === 'pull')

/**
 * Returns whether a value is a source outcome.
 * @param {unknown} value - Raw value
 * @returns {boolean} - Whether it is a checkout or a known miss reason
 */
const isSourceOutcome = (value: unknown): value is SourceOutcome => {
  if (!isPlainObject(value)) {
    return false
  }

  if ('missing' in value) {
    return SOURCE_MISS_REASONS.some((reason) => reason === value.missing)
  }

  const checked = value.checked

  return (
    isPlainObject(checked) &&
    repoUrlOf(checked.repoUrl) === checked.repoUrl &&
    (checked.revision === null || isCommit(checked.revision)) &&
    typeof checked.fromLabel === 'boolean'
  )
}

/**
 * Validates the 200 answer of the fetcher's prepare endpoint before its values reach the prompt.
 * @param {unknown} body - Parsed JSON body
 * @returns {PrepareAnswer} - Images and source outcome
 * @throws {CheckFailure} - When the answer has an unexpected shape
 */
export const parsePrepareAnswer = (body: unknown): PrepareAnswer => {
  if (!isPlainObject(body) || !isPlainObject(body.images)) {
    throw invalid()
  }

  const { prepared, skipped } = body.images

  if (
    !Array.isArray(prepared) ||
    prepared.length === 0 ||
    !prepared.every(isPrepared) ||
    !Array.isArray(skipped) ||
    !skipped.every(isSkipped) ||
    !isSourceOutcome(body.source)
  ) {
    throw invalid()
  }

  return { images: { prepared, skipped }, source: body.source }
}

/**
 * Validates the 422 answer of the fetcher's prepare endpoint.
 * @param {unknown} body - Parsed JSON body
 * @returns {PrepareError} - Reason and the pulled primary image when known
 * @throws {CheckFailure} - When the answer has an unexpected shape
 */
export const parsePrepareError = (body: unknown): PrepareError => {
  if (!isPlainObject(body) || typeof body.error !== 'string' || body.error.trim() === '') {
    throw invalid()
  }

  const pulled = Array.isArray(body.pulled) ? body.pulled.filter(isPulled).slice(0, 1) : []

  return { error: capText(body.error, MAX_CHECK_ERROR_LENGTH), pulled }
}
