import type { WorkerClaim, WorkerClaimImage } from '#core/check.ts'
import { isImageDigest } from '#core/checkPrompt.ts'
import { claimImages } from '#checker/api/claimImages.ts'
import { CheckFailure } from '#checker/CheckFailure.ts'
import { errorTail } from '#checker/process/errorTail.ts'
import type { CheckLayout } from '#checker/workspace/checkLayout.ts'
import { digestOfRef, repositoryOf } from '#checker/workspace/imageRef.ts'
import { runTool, type ToolContext } from '#checker/workspace/runTool.ts'

const DIGEST_MAX_BYTES = 1024

/** An image a check pulls, always by digest */
export interface PulledImage {
  ref: string // repository@digest, what crane config and crane export read
  digest: string
  scanned: boolean // the digest is the scanned one, false when resolved from a tag at check time
  tag: string | null // validated tag of the claim image, names its directory
  claimRef: string // reference of the claim image, repository:tag for a pull by tag
}

/**
 * Picks the digest to pull for one claim image: the scanned digest or the one in its
 * reference, else the digest the tag points to now, resolved with crane digest, so config and
 * export read the same image.
 * @param {WorkerClaimImage} image - Claim image
 * @param {CheckLayout} layout - Check paths
 * @param {ToolContext} context - Runner, config, abort signal and deadline
 * @returns {Promise<PulledImage>} - Reference by digest
 * @throws {CheckFailure} - When the tag cannot be resolved
 */
const resolveImage = async (
  image: WorkerClaimImage,
  layout: CheckLayout,
  context: ToolContext,
): Promise<PulledImage> => {
  const repository = repositoryOf(image.imageRef)
  const known = image.imageDigest ?? digestOfRef(image.imageRef)
  const named = { tag: image.tag, claimRef: image.imageRef }

  if (known !== null) {
    return { ref: `${repository}@${known}`, digest: known, scanned: true, ...named }
  }

  const run = await runTool(
    'image digest',
    { command: 'crane', args: ['digest', image.imageRef], maxStdoutBytes: DIGEST_MAX_BYTES },
    layout,
    context,
  )

  if (run.exit.code !== 0) {
    throw new CheckFailure(`image pull failed: ${run.exit.error ?? errorTail(run.stderr)}`)
  }

  const digest = run.stdout.trim()

  if (!isImageDigest(digest)) {
    throw new CheckFailure('image pull failed: crane digest returned no digest')
  }

  return { ref: `${repository}@${digest}`, digest, scanned: false, ...named }
}

/**
 * Resolves every image of the claim to a digest, primary first. Only a pull by tag runs crane
 * digest, and a claim carries one of those only as its single image.
 * @param {WorkerClaim} claim - Claimed check
 * @param {CheckLayout} layout - Check paths
 * @param {ToolContext} context - Runner, config, abort signal and deadline
 * @returns {Promise<PulledImage[]>} - References by digest
 * @throws {CheckFailure} - When a tag cannot be resolved
 */
export const resolveImages = async (
  claim: WorkerClaim,
  layout: CheckLayout,
  context: ToolContext,
): Promise<PulledImage[]> => {
  const pulled: PulledImage[] = []

  for (const image of claimImages(claim)) {
    pulled.push(await resolveImage(image, layout, context))
  }

  return pulled
}
