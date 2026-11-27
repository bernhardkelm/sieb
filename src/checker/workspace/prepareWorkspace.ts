import { mkdir, rm } from 'node:fs/promises'

import { errorMessage } from '#core/errorMessage.ts'
import { CheckFailure } from '#checker/CheckFailure.ts'
import {
  imageDirLayout,
  imageLayout,
  type CheckLayout,
  type ToolLayout,
} from '#checker/workspace/checkLayout.ts'
import { ImageTooLargeFailure } from '#checker/workspace/exportImage.ts'
import { pullImage, writeInventory } from '#checker/workspace/prepareImage.ts'
import type { PulledImage } from '#checker/workspace/resolveImage.ts'
import type { ToolContext } from '#checker/workspace/runTool.ts'
import { logTag } from '#checker/logTag.ts'

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
 * Creates the private check directory with HOME and TMPDIR, and the workspace unless the
 * fetcher fills it on the shared volume.
 * @param {CheckLayout} layout - Check paths
 * @returns {Promise<void>}
 */
export const createCheckDirs = async (layout: CheckLayout): Promise<void> => {
  if (!layout.sharedWorkspace) {
    await mkdir(layout.images, { recursive: true })
  }

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
 * Pulls every image into its own directory: filesystem and config. The byte cap covers all
 * images together; an extra image that does not fit or fails to pull is removed and skipped,
 * while a failing primary image fails the check.
 * @param {number} checkId - Check id for the log
 * @param {PulledImage[]} images - Images by digest, primary first
 * @param {ToolLayout} layout - Tool paths
 * @param {ToolContext} context - Runner, config, abort signal, deadline and log
 * @param {(images: PulledImage[]) => void} onPulled - Receives the primary image once it is exported and extracted
 * @returns {Promise<WorkspaceImages>} - Prepared and skipped images
 * @throws {CheckFailure} - When pulling, exporting or extracting the primary image fails
 */
export const pullImages = async (
  checkId: number,
  images: PulledImage[],
  layout: ToolLayout,
  context: ToolContext,
  onPulled: (images: PulledImage[]) => void = () => undefined,
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
      budget -= await pullImage(image, paths, layout, { ...context, maxBytes: budget })
      result.prepared.push({ ...image, dir: paths.dir })

      if (index === 0) {
        onPulled([image])
      }
    } catch (error) {
      if (index === 0 || !skippable(error, context)) {
        throw error
      }

      context.log(`${logTag()} check ${checkId}: skipped ${image.ref}: ${errorMessage(error)}`)
      await rm(paths.path, { recursive: true, force: true })
      result.skipped.push({
        image,
        reason: error instanceof ImageTooLargeFailure ? 'size' : 'pull',
      })
    }
  }

  return result
}

/**
 * Writes the inventory of every pulled image.
 * @param {WorkspaceImages} images - Pulled images
 * @param {ToolLayout} layout - Tool paths
 * @param {ToolContext} context - Runner, config, abort signal, deadline and log
 * @returns {Promise<void>}
 */
export const writeInventories = async (
  images: WorkspaceImages,
  layout: ToolLayout,
  context: ToolContext,
): Promise<void> => {
  for (const image of images.prepared) {
    await writeInventory(imageDirLayout(layout, image.dir), layout, context)
  }
}

/**
 * Prepares the workspace: pulls every image, then writes their inventories.
 * @param {number} checkId - Check id for the log
 * @param {PulledImage[]} images - Images by digest, primary first
 * @param {ToolLayout} layout - Tool paths
 * @param {ToolContext} context - Runner, config, abort signal, deadline and log
 * @param {(images: PulledImage[]) => void} onPulled - Receives the primary image once it is exported and extracted
 * @returns {Promise<WorkspaceImages>} - Prepared and skipped images
 * @throws {CheckFailure} - When pulling, exporting or extracting the primary image fails
 */
export const prepareWorkspace = async (
  checkId: number,
  images: PulledImage[],
  layout: ToolLayout,
  context: ToolContext,
  onPulled: (images: PulledImage[]) => void = () => undefined,
): Promise<WorkspaceImages> => {
  const result = await pullImages(checkId, images, layout, context, onPulled)

  await writeInventories(result, layout, context)

  return result
}
