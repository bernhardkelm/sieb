import { mkdir, rm } from 'node:fs/promises'

import type { WorkerClaim } from '#core/check.ts'
import { errorMessage } from '#core/errorMessage.ts'
import { CheckFailure } from '#checker/CheckFailure.ts'
import { writeClaudeFiles } from '#checker/claude/writeClaudeFiles.ts'
import { imageLayout, type CheckLayout } from '#checker/workspace/checkLayout.ts'
import { ImageTooLargeFailure } from '#checker/workspace/exportImage.ts'
import { prepareImage } from '#checker/workspace/prepareImage.ts'
import type { PulledImage } from '#checker/workspace/resolveImage.ts'
import type { ToolContext } from '#checker/workspace/runTool.ts'

/** A pulled image in the workspace */
export interface PreparedImage extends PulledImage {
  dir: string // relative to the workspace, images/<n>-<tag>
}

/** An extra image the workspace lacks and why */
export interface SkippedImage {
  image: PulledImage
  reason: 'size' | 'pull' // over the remaining size cap, or its pull or extraction failed
}

/** What the workspace holds */
export interface WorkspaceImages {
  prepared: PreparedImage[] // primary first
  skipped: SkippedImage[]
}

/**
 * Creates the check directory with the workspace, HOME and TMPDIR.
 * @param {CheckLayout} layout - Check paths
 * @returns {Promise<void>}
 */
export const createCheckDirs = async (layout: CheckLayout): Promise<void> => {
  await mkdir(layout.images, { recursive: true })
  await mkdir(layout.home, { recursive: true, mode: 0o700 })
  await mkdir(layout.tmp, { recursive: true, mode: 0o700 })
}

/**
 * Returns whether a failed extra image is skipped: the failure is an expected one and the
 * check was neither stopped nor out of time, which would fail the next step as well.
 * @param {unknown} error - Failure of the image
 * @param {ToolContext} context - Abort signal and deadline
 * @returns {boolean} - Whether to skip the image and go on
 */
const skippable = (error: unknown, context: ToolContext): boolean =>
  error instanceof CheckFailure && !context.signal.aborted && context.remainingMs() > 0

/**
 * Prepares the created check directory: one directory per image with its filesystem, config
 * and inventory, then Claude's MCP config and settings outside the workspace. The byte cap
 * covers all images together; an extra image that does not fit or fails to pull is removed
 * and skipped, while a failing primary image fails the check.
 * @param {WorkerClaim} claim - Claimed check
 * @param {PulledImage[]} images - Images by digest, primary first
 * @param {CheckLayout} layout - Check paths
 * @param {ToolContext} context - Runner, config, abort signal, deadline and log
 * @returns {Promise<WorkspaceImages>} - Prepared and skipped images
 * @throws {CheckFailure} - When pulling, exporting or extracting the primary image fails
 */
export const prepareWorkspace = async (
  claim: WorkerClaim,
  images: PulledImage[],
  layout: CheckLayout,
  context: ToolContext,
): Promise<WorkspaceImages> => {
  const result: WorkspaceImages = { prepared: [], skipped: [] }
  let budget = context.config.imageMaxBytes

  for (const [index, image] of images.entries()) {
    const paths = imageLayout(layout, index, image.tag)

    if (budget <= 0) {
      result.skipped.push({ image, reason: 'size' })
      continue
    }

    try {
      budget -= await prepareImage(image, paths, layout, { ...context, maxBytes: budget })
      result.prepared.push({ ...image, dir: paths.dir })
    } catch (error) {
      if (index === 0 || !skippable(error, context)) {
        throw error
      }

      context.log(
        `[sieb-checker] check ${claim.checkId}: skipped ${image.ref}: ${errorMessage(error)}`,
      )
      await rm(paths.path, { recursive: true, force: true })
      result.skipped.push({
        image,
        reason: error instanceof ImageTooLargeFailure ? 'size' : 'pull',
      })
    }
  }

  await writeClaudeFiles(claim, layout, context.config)

  return result
}
