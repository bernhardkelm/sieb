import { readdir, readlink, realpath, symlink, unlink } from 'node:fs/promises'
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path'

import { realpathInside } from '#checker/workspace/insidePath.ts'

/** Counts of a symlink containment pass */
export interface ContainmentStats {
  rewritten: number
  removed: number
}

/**
 * Lists every symlink below a directory without following any of them.
 * @param {string} root - Directory to walk
 * @returns {Promise<string[]>} - Absolute symlink paths
 */
const collectSymlinks = async (root: string): Promise<string[]> => {
  const links: string[] = []
  const pending = [root]

  for (let dir = pending.pop(); dir !== undefined; dir = pending.pop()) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)

      if (entry.isSymbolicLink()) {
        links.push(path)
      } else if (entry.isDirectory()) {
        pending.push(path)
      }
    }
  }

  return links
}

/**
 * Returns where a link target points inside the image root, resolved as in the container: an
 * absolute target from the image root, and ".." never climbs above it.
 * @param {string} realRoot - Resolved image root
 * @param {string} link - Absolute path of the link
 * @param {string} target - Link target
 * @returns {string | null} - Absolute path below the root, null when the target needs no rewrite
 */
const containedTarget = (realRoot: string, link: string, target: string): string | null => {
  const linkDir = relative(realRoot, dirname(link))

  if (!isAbsolute(target) && !normalize(join(linkDir, target)).startsWith('..')) {
    return null
  }

  return join(realRoot, resolve('/', linkDir, target))
}

/**
 * Keeps every symlink of an extracted image inside the image: absolute targets and relative
 * targets that climb above the root are rewritten relative to the root, as they would resolve
 * in the container, then links that still resolve outside the root or not at all are removed.
 * Afterwards no path below the root leads to the worker's own filesystem.
 * @param {string} root - Extracted image root
 * @returns {Promise<ContainmentStats>} - Number of rewritten and removed links
 */
export const containSymlinks = async (root: string): Promise<ContainmentStats> => {
  const realRoot = await realpath(root)
  const links = await collectSymlinks(realRoot)
  const stats: ContainmentStats = { rewritten: 0, removed: 0 }

  for (const link of links) {
    const inside = containedTarget(realRoot, link, await readlink(link))

    if (inside !== null) {
      await unlink(link)
      await symlink(relative(dirname(link), inside) || '.', link)
      stats.rewritten++
    }
  }

  for (const link of links) {
    if ((await realpathInside(realRoot, link)) === null) {
      await unlink(link)
      stats.removed++
    }
  }

  return stats
}
