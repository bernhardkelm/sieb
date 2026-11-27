import { join } from 'node:path'

/** Paths of one check directory */
export interface CheckLayout {
  root: string // <workdir>/check-<id>, wiped after the check
  workspace: string // Claude's working directory, holds only what Claude may read
  imageDir: string
  imageConfig: string
  inventory: string
  home: string // HOME of Claude and the tools, outside the workspace
  tmp: string // TMPDIR of Claude and the tools, the root filesystem is read-only
  mcpConfig: string // holds the sieb token, outside the workspace
  settings: string
  syftOutput: string // untrimmed syft output, outside the workspace
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
    imageDir: join(workspace, 'image'),
    imageConfig: join(workspace, 'image-config.json'),
    inventory: join(workspace, 'inventory.json'),
    home: join(root, 'home'),
    tmp: join(root, 'tmp'),
    mcpConfig: join(root, 'mcp.json'),
    settings: join(root, 'settings.json'),
    syftOutput: join(root, 'syft.json'),
  }
}
