import { MAX_CHECK_IMAGES, MAX_CHECK_TIMEOUT_SECONDS } from '#core/checkLimits.ts'
import { isPlainObject } from '#core/isPlainObject.ts'
import { isClaimImageList } from '#checker/api/claimImages.ts'
import type { PrepareRequest } from '#checker/prepare/prepareTypes.ts'

/**
 * Returns whether a value is an integer between min and max.
 * @param {unknown} value - Raw value
 * @param {number} min - Smallest allowed value
 * @param {number} max - Largest allowed value
 * @returns {boolean} - Whether it is in range
 */
const isIntBetween = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max

/**
 * Validates the body of POST /prepare before any of its values reach a command line.
 * @param {unknown} body - Parsed JSON body
 * @returns {PrepareRequest | null} - Request, null when invalid
 */
export const parsePrepareRequest = (body: unknown): PrepareRequest | null => {
  if (!isPlainObject(body) || !Array.isArray(body.images)) {
    return null
  }

  const images: unknown[] = body.images.slice(0, MAX_CHECK_IMAGES)
  const primary = isPlainObject(images[0]) ? images[0] : {}
  const valid =
    isIntBetween(body.checkId, 1, Number.MAX_SAFE_INTEGER) &&
    isIntBetween(body.timeoutMs, 0, MAX_CHECK_TIMEOUT_SECONDS * 1000) &&
    isClaimImageList({ imageRef: primary.imageRef, imageDigest: primary.imageDigest, images })

  return valid
    ? {
        checkId: body.checkId as number,
        images: images as PrepareRequest['images'],
        timeoutMs: body.timeoutMs as number,
      }
    : null
}

/**
 * Reads the check id of POST /release.
 * @param {unknown} body - Parsed JSON body
 * @returns {number | null} - Check id, null when invalid
 */
export const parseReleaseRequest = (body: unknown): number | null =>
  isPlainObject(body) && isIntBetween(body.checkId, 1, Number.MAX_SAFE_INTEGER)
    ? body.checkId
    : null
