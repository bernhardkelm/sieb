import { join } from 'node:path'

/** Paths the image tools read and write */
export interface ToolLayout {
  workspace: string // Claude's working directory, holds only what Claude may read
  images: string // one directory per pulled image below the workspace
  home: string // HOME of the tools, outside the workspace
  tmp: string // TMPDIR of the tools, the root filesystem is read-only
  syftOutput: string // untrimmed syft output, outside the workspace
  dockerConfig: string | null // DOCKER_CONFIG of crane, null for anonymous pulls only
}

/** Paths of one check directory */
export interface CheckLayout extends ToolLayout {
  root: string // <workdir>/check-<id>, wiped after the check
  sharedWorkspace: boolean // the fetcher fills the workspace on the shared volume
  mcpConfig: string // holds the sieb token, outside the workspace
  settings: string
}

/** Paths of one pulled image in the workspace */
export interface ImageLayout {
  dir: string // relative to the workspace, images/<n>-<tag>
  path: string // absolute dir
  rootfs: string // the flattened filesystem
  config: string // image-config.json
  inventory: string // inventory.json
}

/** Prefix of every check directory in the work directory */
export const CHECK_DIR_PREFIX = 'check-'

/**
 * Returns the paths of a check directory. With a shared directory the workspace is the check's
 * directory there, which the fetcher fills, and everything else stays in the private workdir.
 * @param {string} workdir - Absolute private work directory
 * @param {number} checkId - Check id
 * @param {string | null} sharedDir - Absolute shared directory of the fetcher, null without one
 * @returns {CheckLayout} - Paths below <workdir>/check-<id>
 */
export const checkLayout = (
  workdir: string,
  checkId: number,
  sharedDir: string | null = null,
): CheckLayout => {
  const name = `${CHECK_DIR_PREFIX}${checkId}`
  const root = join(workdir, name)
  const workspace = sharedDir === null ? join(root, 'workspace') : join(sharedDir, name)

  return {
    root,
    sharedWorkspace: sharedDir !== null,
    workspace,
    images: join(workspace, 'images'),
    home: join(root, 'home'),
    tmp: join(root, 'tmp'),
    mcpConfig: join(root, 'mcp.json'),
    settings: join(root, 'settings.json'),
    syftOutput: join(root, 'syft.json'),
    dockerConfig: null,
  }
}

/**
 * Returns the paths of an image directory of the workspace.
 * @param {ToolLayout} layout - Tool paths
 * @param {string} dir - Directory relative to the workspace, images/<n>-<tag>
 * @returns {ImageLayout} - Paths of the image
 */
export const imageDirLayout = (layout: ToolLayout, dir: string): ImageLayout => {
  const path = join(layout.workspace, dir)

  return {
    dir,
    path,
    rootfs: join(path, 'rootfs'),
    config: join(path, 'image-config.json'),
    inventory: join(path, 'inventory.json'),
  }
}

/**
 * Returns the paths of the n-th pulled image, named by position and tag.
 * @param {ToolLayout} layout - Tool paths
 * @param {number} index - 0-based position of the image, the primary image is 0
 * @param {string | null} tag - Validated tag, null when none is known
 * @returns {ImageLayout} - Paths below images/<index + 1>-<tag>
 */
export const imageLayout = (layout: ToolLayout, index: number, tag: string | null): ImageLayout =>
  imageDirLayout(layout, `images/${index + 1}-${tag ?? 'untagged'}`)
