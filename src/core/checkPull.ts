import type { CheckedImage, WorkerClaimImage } from '#core/check.ts'
import { MAX_CHECK_IMAGES } from '#core/checkLimits.ts'
import { isImageDigest, isImageTag } from '#core/checkPrompt.ts'
import type { FindingInstance } from '#core/instance.ts'

export type PullInstance = Pick<
  FindingInstance,
  'id' | 'imageTag' | 'imageDigest' | 'lastSeen' | 'resolvedAt'
>

/** What the worker pulls: the primary image first, by digest whenever sieb knows one */
export interface CheckPull {
  imageRef: string // primary image, repository@digest or repository:tag
  imageDigest: string | null // null when only the tag is known
  images: WorkerClaimImage[] // primary first, at most MAX_CHECK_IMAGES
  notPulled: string[] // open tags or digests no pulled image covers, most recently seen first
}

/**
 * Orders instances most recently seen first, the higher id first on a tie.
 * @param {PullInstance} a - Instance
 * @param {PullInstance} b - Instance
 * @returns {number} - Sort order
 */
const byRecency = (a: PullInstance, b: PullInstance): number =>
  b.lastSeen.localeCompare(a.lastSeen) || b.id - a.id

/**
 * Returns a tag that is safe in a reference and a directory name.
 * @param {string | null} tag - Tag of an instance
 * @returns {string | null} - The tag, null when absent or invalid
 */
const safeTag = (tag: string | null): string | null =>
  tag !== null && isImageTag(tag) ? tag : null

/**
 * Returns the valid digest of an instance.
 * @param {PullInstance} instance - Instance
 * @returns {string | null} - Digest, null when absent or invalid
 */
const digestOf = (instance: PullInstance): string | null =>
  instance.imageDigest !== null && isImageDigest(instance.imageDigest) ? instance.imageDigest : null

/**
 * Returns one image per distinct digest, in instance order, each with the first valid tag.
 * @param {string} imageRef - Image ref of the finding, without tag
 * @param {readonly PullInstance[]} open - Open instances, most recently seen first
 * @returns {WorkerClaimImage[]} - Images of all digests
 */
const digestImages = (imageRef: string, open: readonly PullInstance[]): WorkerClaimImage[] => {
  const images = new Map<string, WorkerClaimImage>()

  for (const instance of open) {
    const digest = digestOf(instance)

    if (digest === null) {
      continue
    }

    const known = images.get(digest)
    const tag = safeTag(instance.imageTag)

    if (known === undefined) {
      images.set(digest, { imageRef: `${imageRef}@${digest}`, imageDigest: digest, tag })
    } else if (known.tag === null) {
      known.tag = tag
    }
  }

  return [...images.values()]
}

/**
 * Names the open instances no pulled image covers: a digest beyond the cap, with its tag, or
 * a tag no pulled image carries.
 * @param {readonly PullInstance[]} open - Open instances, most recently seen first
 * @param {readonly WorkerClaimImage[]} pulled - Pulled images
 * @returns {string[]} - Distinct labels such as "16 (sha256:0123456789ab)" or "15-alpine"
 */
const uncovered = (
  open: readonly PullInstance[],
  pulled: readonly WorkerClaimImage[],
): string[] => {
  const digests = new Set(pulled.map((image) => image.imageDigest))
  const tags = new Set(pulled.map((image) => image.tag))
  const labels = new Set<string>()

  for (const instance of open) {
    const digest = digestOf(instance)
    const tag = safeTag(instance.imageTag)

    if (digest !== null && !digests.has(digest)) {
      labels.add(tag === null ? digest.slice(0, 19) : `${tag} (${digest.slice(0, 19)})`)
    } else if (digest === null && tag !== null && !tags.has(tag)) {
      labels.add(tag)
    }
  }

  return [...labels]
}

/**
 * Returns what the worker pulls: one image per distinct digest of the open instances, most
 * recently seen first and at most MAX_CHECK_IMAGES; without any digest the tag of the most
 * recently seen open instance. Never a bare ref, which would pull latest, a different image
 * than the one Trivy scanned. Values that are not a valid tag or digest are skipped, so the
 * ref never carries scanner text.
 * @param {string} imageRef - Image ref of the finding, without tag
 * @param {readonly PullInstance[]} instances - Instances of the finding
 * @returns {CheckPull | null} - Pull, null when sieb knows neither a digest nor a tag
 */
export const checkPullRef = (
  imageRef: string,
  instances: readonly PullInstance[],
): CheckPull | null => {
  const open = instances.filter((instance) => instance.resolvedAt === null).sort(byRecency)
  const byDigest = digestImages(imageRef, open).slice(0, MAX_CHECK_IMAGES)
  const tag = open.map((instance) => safeTag(instance.imageTag)).find((value) => value !== null)
  const images =
    byDigest.length > 0 || tag === undefined
      ? byDigest
      : [{ imageRef: `${imageRef}:${tag}`, imageDigest: null, tag }]
  const [primary] = images

  return primary === undefined
    ? null
    : {
        imageRef: primary.imageRef,
        imageDigest: primary.imageDigest,
        images,
        notPulled: uncovered(open, images),
      }
}

/**
 * Names the images a worker reports it exported with the tag sieb knows for each digest: the
 * tag of an instance with that digest, open and recently seen ones first, else the tag of a
 * pull by tag, whose digest the worker resolved itself.
 * @param {readonly string[]} digests - Reported digests, primary first
 * @param {readonly PullInstance[]} instances - Instances of the check's finding
 * @returns {CheckedImage[]} - Digest and tag per image
 */
export const checkedImagesOf = (
  digests: readonly string[],
  instances: readonly PullInstance[],
): CheckedImage[] => {
  const ordered = [...instances].sort(
    (a, b) => Number(a.resolvedAt !== null) - Number(b.resolvedAt !== null) || byRecency(a, b),
  )
  const pull = checkPullRef('', instances)
  const tagPull = pull !== null && pull.imageDigest === null ? pull.images[0]?.tag : null

  return digests.map((digest) => {
    const matching = ordered.filter((instance) => instance.imageDigest === digest)
    const tag = matching.map((instance) => safeTag(instance.imageTag)).find((t) => t !== null)

    return { digest, tag: tag ?? (matching.length === 0 ? (tagPull ?? null) : null) }
  })
}
