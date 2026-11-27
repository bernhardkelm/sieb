import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'

import type { WorkerClaim } from '#core/check.ts'
import { CheckFailure } from '#checker/CheckFailure.ts'
import { writeClaudeFiles } from '#checker/claude/writeClaudeFiles.ts'
import { errorTail } from '#checker/process/errorTail.ts'
import type { CheckLayout } from '#checker/workspace/checkLayout.ts'
import { containSymlinks } from '#checker/workspace/containSymlinks.ts'
import { exportImage } from '#checker/workspace/exportImage.ts'
import type { PulledImage } from '#checker/workspace/resolveImage.ts'
import { runTool, toolEnv, type ToolContext } from '#checker/workspace/runTool.ts'
import { trimInventory } from '#checker/workspace/trimInventory.ts'

const CONFIG_MAX_BYTES = 4 * 1024 * 1024

/**
 * Creates the check directory with the workspace, HOME and TMPDIR.
 * @param {CheckLayout} layout - Check paths
 * @returns {Promise<void>}
 */
export const createCheckDirs = async (layout: CheckLayout): Promise<void> => {
  await mkdir(layout.imageDir, { recursive: true })
  await mkdir(layout.home, { recursive: true, mode: 0o700 })
  await mkdir(layout.tmp, { recursive: true, mode: 0o700 })
}

/**
 * Writes the image config from crane config, the first pull of the image.
 * @param {PulledImage} image - Image by digest
 * @param {CheckLayout} layout - Check paths
 * @param {ToolContext} context - Runner, config and abort handling
 * @returns {Promise<void>}
 * @throws {CheckFailure} - When the image cannot be pulled or its config is too large
 */
const writeImageConfig = async (
  image: PulledImage,
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

  await writeFile(layout.imageConfig, run.stdout)
}

/**
 * Writes inventory.json from a syft scan of the image directory; a failed scan leaves a note
 * instead of failing the check.
 * @param {CheckLayout} layout - Check paths
 * @param {ToolContext} context - Runner, config and abort handling
 * @returns {Promise<void>}
 */
const writeInventory = async (layout: CheckLayout, context: ToolContext): Promise<void> => {
  const run = await runTool(
    'inventory scan',
    {
      command: 'syft',
      args: ['scan', 'dir:image', '-q', '-o', `json=${layout.syftOutput}`],
      maxStdoutBytes: 0,
    },
    layout,
    context,
  )

  if (run.exit.code !== 0) {
    const reason = run.exit.error ?? errorTail(run.stderr)

    context.log(`[sieb-checker] syft failed: ${reason}`)
    await writeFile(layout.inventory, JSON.stringify({ error: `syft failed: ${reason}` }))

    return
  }

  await writeFile(layout.inventory, trimInventory(await readFile(layout.syftOutput, 'utf8')))
  await rm(layout.syftOutput, { force: true })
}

/**
 * Prepares the created check directory: the image files, its config and inventory in the
 * workspace, then Claude's MCP config and settings outside of it.
 * @param {WorkerClaim} claim - Claimed check
 * @param {PulledImage} image - Image by digest
 * @param {CheckLayout} layout - Check paths
 * @param {ToolContext} context - Runner, config, abort signal, deadline and log
 * @returns {Promise<void>}
 * @throws {CheckFailure} - When pulling, exporting or extracting the image fails
 */
export const prepareWorkspace = async (
  claim: WorkerClaim,
  image: PulledImage,
  layout: CheckLayout,
  context: ToolContext,
): Promise<void> => {
  await writeImageConfig(image, layout, context)

  const stats = await exportImage({
    runner: context.runner,
    imageRef: image.ref,
    platform: context.config.platform,
    imageDir: layout.imageDir,
    maxBytes: context.config.imageMaxBytes,
    env: toolEnv(context.config, layout),
    signal: context.signal,
    timeoutMs: context.remainingMs(),
  })
  const links = await containSymlinks(layout.imageDir)

  context.log(
    `[sieb-checker] check ${claim.checkId}: ${stats.entries} entries extracted, dropped ` +
      `${JSON.stringify(stats.dropped)}, symlinks rewritten ${links.rewritten}, removed ${links.removed}`,
  )
  await writeInventory(layout, context)
  await writeClaudeFiles(claim, layout, context.config)
}
