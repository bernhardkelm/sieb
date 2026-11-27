import type { WorkerClaim } from '#core/check.ts'
import { isImageDigest } from '#core/checkPrompt.ts'
import { CheckFailure } from '#checker/CheckFailure.ts'
import { errorTail } from '#checker/process/errorTail.ts'
import type { CheckLayout } from '#checker/workspace/checkLayout.ts'
import { digestOfRef, repositoryOf } from '#checker/workspace/imageRef.ts'
import { runTool, type ToolContext } from '#checker/workspace/runTool.ts'

const DIGEST_MAX_BYTES = 1024

/** The image a check pulls, always by digest */
export interface PulledImage {
  ref: string // repository@digest, what crane config and crane export read
  digest: string
  scanned: boolean // the digest is the scanned one, false when resolved from a tag at check time
}

/**
 * Picks the digest to pull: the scanned digest from the claim or its reference, else the digest
 * the tag points to now, resolved with crane digest, so config and export read the same image.
 * @param {WorkerClaim} claim - Claimed check
 * @param {CheckLayout} layout - Check paths
 * @param {ToolContext} context - Runner, config, abort signal and deadline
 * @returns {Promise<PulledImage>} - Reference by digest
 * @throws {CheckFailure} - When the tag cannot be resolved
 */
export const resolveImage = async (
  claim: WorkerClaim,
  layout: CheckLayout,
  context: ToolContext,
): Promise<PulledImage> => {
  const repository = repositoryOf(claim.imageRef)
  const known = claim.imageDigest ?? digestOfRef(claim.imageRef)

  if (known !== null) {
    return { ref: `${repository}@${known}`, digest: known, scanned: true }
  }

  const run = await runTool(
    'image digest',
    { command: 'crane', args: ['digest', claim.imageRef], maxStdoutBytes: DIGEST_MAX_BYTES },
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

  return { ref: `${repository}@${digest}`, digest, scanned: false }
}
