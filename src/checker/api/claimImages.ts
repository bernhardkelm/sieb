import type { WorkerClaim, WorkerClaimImage } from '#core/check.ts'
import { MAX_CHECK_IMAGES } from '#core/checkLimits.ts'
import { isImageDigest, isImageTag } from '#core/checkPrompt.ts'
import { digestOfRef, isPinnedRef, tagOfRef } from '#checker/workspace/imageRef.ts'

// no leading dash, so the reference cannot be read as a crane flag
const IMAGE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\-/:@+]{0,511}$/

/**
 * Returns whether an image reference is valid and pinned by a tag or a valid digest, so crane
 * never falls back to latest.
 * @param {unknown} ref - Raw reference
 * @returns {boolean} - Whether the reference is acceptable
 */
export const isPinnedImageRef = (ref: unknown): ref is string => {
  if (typeof ref !== 'string' || !IMAGE_REF_PATTERN.test(ref) || !isPinnedRef(ref)) {
    return false
  }

  const refDigest = digestOfRef(ref)

  return refDigest === null || isImageDigest(refDigest)
}

/**
 * Returns whether a scanned digest is absent or valid and matches a digest in the reference.
 * @param {unknown} digest - Raw digest
 * @param {unknown} ref - Raw reference
 * @returns {boolean} - Whether the digest is acceptable
 */
export const isScannedDigest = (digest: unknown, ref: unknown): boolean => {
  if (digest === null || digest === undefined) {
    return true
  }

  if (typeof digest !== 'string' || !isImageDigest(digest)) {
    return false
  }

  const refDigest = typeof ref === 'string' ? digestOfRef(ref) : null

  return refDigest === null || refDigest === digest
}

/**
 * Returns whether a raw value is a valid image of a claim.
 * @param {unknown} value - Raw image
 * @returns {boolean} - Whether ref, digest and tag are acceptable
 */
const isClaimImage = (value: unknown): value is WorkerClaimImage => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const { imageRef, imageDigest, tag } = value as Record<string, unknown>

  return (
    isPinnedImageRef(imageRef) &&
    isScannedDigest(imageDigest, imageRef) &&
    (tag === null || tag === undefined || (typeof tag === 'string' && isImageTag(tag)))
  )
}

/**
 * Returns whether the images of a raw claim are absent or valid: images beyond
 * MAX_CHECK_IMAGES are ignored, the first must be the primary image, every further one must
 * carry a digest, and no reference repeats.
 * @param {Record<string, unknown>} claim - Raw claim
 * @returns {boolean} - Whether images is acceptable
 */
export const isClaimImageList = (claim: Record<string, unknown>): boolean => {
  const images = claim.images

  if (images === undefined || images === null) {
    return true
  }

  if (!Array.isArray(images) || images.length === 0) {
    return false
  }

  const kept: unknown[] = images.slice(0, MAX_CHECK_IMAGES)

  if (!kept.every(isClaimImage)) {
    return false
  }

  const [primary, ...extra] = kept as WorkerClaimImage[]

  return (
    primary?.imageRef === claim.imageRef &&
    (primary.imageDigest ?? null) === (claim.imageDigest ?? null) &&
    extra.every((image) => typeof image.imageDigest === 'string') &&
    new Set(kept.map((image) => (image as WorkerClaimImage).imageRef)).size === kept.length
  )
}

/**
 * Returns the images of a validated claim, primary first: the claim's list cut to
 * MAX_CHECK_IMAGES, or for a claim of an older sieb its single image with the tag of its
 * reference.
 * @param {WorkerClaim} claim - Validated claim
 * @returns {WorkerClaimImage[]} - Images with a null digest or tag where none is known
 */
export const claimImages = (claim: WorkerClaim): WorkerClaimImage[] => {
  if (claim.images !== undefined && claim.images !== null && claim.images.length > 0) {
    return claim.images.slice(0, MAX_CHECK_IMAGES).map((image) => ({
      imageRef: image.imageRef,
      imageDigest: image.imageDigest ?? null,
      tag: image.tag ?? null,
    }))
  }

  const tag = tagOfRef(claim.imageRef)

  return [
    {
      imageRef: claim.imageRef,
      imageDigest: claim.imageDigest ?? null,
      tag: tag !== null && isImageTag(tag) ? tag : null,
    },
  ]
}
