import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'

import { CheckFailure } from '#checker/CheckFailure.ts'
import { errorTail } from '#checker/process/errorTail.ts'
import type { CheckLayout, ImageLayout } from '#checker/workspace/checkLayout.ts'
import { containSymlinks } from '#checker/workspace/containSymlinks.ts'
import { exportImage } from '#checker/workspace/exportImage.ts'
import type { PulledImage } from '#checker/workspace/resolveImage.ts'
import { runTool, toolEnv, type ToolContext } from '#checker/workspace/runTool.ts'
import { trimInventory } from '#checker/workspace/trimInventory.ts'

const CONFIG_MAX_BYTES = 4 * 1024 * 1024

/**
 * Writes the image config from crane config, the first pull of the image.
 * @param {PulledImage} image - Image by digest
 * @param {ImageLayout} paths - Paths of the image
 * @param {CheckLayout} layout - Check paths
 * @param {ToolContext} context - Runner, config and abort handling
 * @returns {Promise<void>}
 * @throws {CheckFailure} - When the image cannot be pulled or its config is too large
 */
const writeImageConfig = async (
  image: PulledImage,
  paths: ImageLayout,
  layout: CheckLayout,
  context: ToolContext,
): Promise<void> => {
  const run = await runTool(
    'image config',
    {
      command: 'crane',
      args: ['config', '--platform', context.config.platform, image.ref],
      maxStdoutBytes: CONFIG_MAX_BYTES,
    },
    layout,
    context,
  )

  if (run.exit.code !== 0) {
    throw new CheckFailure(`image pull failed: ${run.exit.error ?? errorTail(run.stderr)}`)
  }

  if (run.stdoutTruncated) {
    throw new CheckFailure(`image config exceeds ${CONFIG_MAX_BYTES} bytes`)
  }

  await writeFile(paths.config, run.stdout)
}

/**
 * Writes inventory.json from a syft scan of the image filesystem; a failed scan leaves a note
 * instead of failing the check.
 * @param {ImageLayout} paths - Paths of the image
 * @param {CheckLayout} layout - Check paths
 * @param {ToolContext} context - Runner, config and abort handling
 * @returns {Promise<void>}
 */
const writeInventory = async (
  paths: ImageLayout,
  layout: CheckLayout,
  context: ToolContext,
): Promise<void> => {
  const run = await runTool(
    'inventory scan',
    {
      command: 'syft',
      args: ['scan', `dir:${paths.dir}/rootfs`, '-q', '-o', `json=${layout.syftOutput}`],
      maxStdoutBytes: 0,
    },
    layout,
    context,
  )

  if (run.exit.code !== 0) {
    const reason = run.exit.error ?? errorTail(run.stderr)

    context.log(`[sieb-checker] syft failed: ${reason}`)
    await writeFile(paths.inventory, JSON.stringify({ error: `syft failed: ${reason}` }))

    return
  }

  await writeFile(paths.inventory, trimInventory(await readFile(layout.syftOutput, 'utf8')))
  await rm(layout.syftOutput, { force: true })
}

/**
 * Fills the directory of one image: its config, the filesystem through the tar filter with
 * the remaining byte budget, contained symlinks and the inventory.
 * @param {PulledImage} image - Image by digest
 * @param {ImageLayout} paths - Paths of the image
 * @param {CheckLayout} layout - Check paths
 * @param {ToolContext & { maxBytes: number }} context - Tool context and the byte budget
 * @returns {Promise<number>} - Uncompressed bytes the export read
 * @throws {CheckFailure} - When pulling, exporting or extracting the image fails
 */
export const prepareImage = async (
  image: PulledImage,
  paths: ImageLayout,
  layout: CheckLayout,
  context: ToolContext & { maxBytes: number },
): Promise<number> => {
  await mkdir(paths.rootfs, { recursive: true })
  await writeImageConfig(image, paths, layout, context)

  const stats = await exportImage({
    runner: context.runner,
    imageRef: image.ref,
    platform: context.config.platform,
    imageDir: paths.rootfs,
    maxBytes: context.maxBytes,
    env: toolEnv(context.config, layout),
    signal: context.signal,
    timeoutMs: context.remainingMs(),
  })
  const links = await containSymlinks(paths.rootfs)

  context.log(
    `[sieb-checker] ${paths.dir}: ${stats.entries} entries extracted, dropped ` +
      `${JSON.stringify(stats.dropped)}, symlinks rewritten ${links.rewritten}, removed ${links.removed}`,
  )
  await writeInventory(paths, layout, context)

  return stats.bytes
}
