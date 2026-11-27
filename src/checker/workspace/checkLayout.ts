import { join } from 'node:path'

/** Paths of one check directory */
export interface CheckLayout {
  root: string // <workdir>/check-<id>, wiped after the check
  workspace: string // Claude's working directory, holds only what Claude may read
  images: string // one directory per pulled image below the workspace
  home: string // HOME of Claude and the tools, outside the workspace
  tmp: string // TMPDIR of Claude and the tools, the root filesystem is read-only
  mcpConfig: string // holds the sieb token, outside the workspace
  settings: string
  syftOutput: string // untrimmed syft output, outside the workspace
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
 * Returns the paths of a check directory.
 * @param {string} workdir - Absolute work directory
 * @param {number} checkId - Check id
 * @returns {CheckLayout} - Paths below <workdir>/check-<id>
 */
export const checkLayout = (workdir: string, checkId: number): CheckLayout => {
  const root = join(workdir, `${CHECK_DIR_PREFIX}${checkId}`)
  const workspace = join(root, 'workspace')

  return {
    root,
    workspace,
    images: join(workspace, 'images'),
    home: join(root, 'home'),
    tmp: join(root, 'tmp'),
    mcpConfig: join(root, 'mcp.json'),
    settings: join(root, 'settings.json'),
    syftOutput: join(root, 'syft.json'),
  }
}

/**
 * Returns the paths of the n-th pulled image, named by position and tag.
 * @param {CheckLayout} layout - Check paths
 * @param {number} index - 0-based position of the image, the primary image is 0
 * @param {string | null} tag - Validated tag, null when none is known
 * @returns {ImageLayout} - Paths below images/<index + 1>-<tag>
 */
export const imageLayout = (
  layout: CheckLayout,
  index: number,
  tag: string | null,
): ImageLayout => {
  const name = `${index + 1}-${tag ?? 'untagged'}`
  const path = join(layout.images, name)

  return {
    dir: `images/${name}`,
    path,
    rootfs: join(path, 'rootfs'),
    config: join(path, 'image-config.json'),
    inventory: join(path, 'inventory.json'),
  }
}
