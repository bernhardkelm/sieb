import { join } from 'node:path'

import { CHECK_DIR_PREFIX, type ToolLayout } from '#checker/workspace/checkLayout.ts'

/** Paths the fetcher uses for one check */
export interface FetchLayout extends ToolLayout {
  privateRoot: string // <workdir>/check-<id>: HOME, TMPDIR, DOCKER_CONFIG, never shared
  source: string // source/ below the workspace
  dockerConfig: string // DOCKER_CONFIG of crane, removed right after the pulls
}

/**
 * Returns the paths of one check in the fetcher: the workspace on the shared volume, which the
 * checker reads, and everything that may hold a credential in the private work directory.
 * @param {string} workdir - Absolute private work directory
 * @param {string} sharedDir - Absolute shared directory
 * @param {number} checkId - Check id
 * @returns {FetchLayout} - Paths of the check
 */
export const fetchLayout = (workdir: string, sharedDir: string, checkId: number): FetchLayout => {
  const name = `${CHECK_DIR_PREFIX}${checkId}`
  const privateRoot = join(workdir, name)
  const workspace = join(sharedDir, name)

  return {
    privateRoot,
    workspace,
    images: join(workspace, 'images'),
    source: join(workspace, 'source'),
    home: join(privateRoot, 'home'),
    tmp: join(privateRoot, 'tmp'),
    syftOutput: join(privateRoot, 'syft.json'),
    dockerConfig: join(privateRoot, 'docker'),
  }
}
