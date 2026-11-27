import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

import { dirBytes } from '#checker/source/dirBytes.ts'
import { containSymlinks } from '#checker/workspace/containSymlinks.ts'

// ripgrep honours these, they would hide files from Claude's Grep, as for the images
const IGNORE_FILES = new Set(['.gitignore', '.ignore', '.rgignore'])

/**
 * Removes the ignore files below a directory.
 * @param {string} root - Checked-out tree
 * @returns {Promise<number>} - Number of removed files
 */
const removeIgnoreFiles = async (root: string): Promise<number> => {
  let removed = 0
  const pending = [root]

  for (let dir = pending.pop(); dir !== undefined; dir = pending.pop()) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)

      if (entry.isDirectory()) {
        pending.push(path)
      } else if (IGNORE_FILES.has(entry.name)) {
        await rm(path, { force: true })
        removed++
      }
    }
  }

  return removed
}

/**
 * Turns a checkout into the plain tree Claude reads: deletes .git with its objects and remote
 * URL, the ignore files, and every symlink that leads out of the tree, then checks the size cap.
 * @param {string} root - Checked-out tree
 * @param {number} maxBytes - Source size cap
 * @returns {Promise<boolean>} - Whether the tree fits the cap
 */
export const tidySource = async (root: string, maxBytes: number): Promise<boolean> => {
  await rm(join(root, '.git'), { recursive: true, force: true })
  await removeIgnoreFiles(root)
  await containSymlinks(root)

  return (await dirBytes(root, maxBytes)) <= maxBytes
}
