import { lstat, readdir } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Sums the sizes of the files below a directory without following symlinks, stopping early once
 * the sum passes a limit.
 * @param {string} root - Directory to measure
 * @param {number} limit - Size at which counting stops
 * @returns {Promise<number>} - Bytes counted, above limit when the tree is larger
 */
export const dirBytes = async (root: string, limit: number): Promise<number> => {
  let total = 0
  const pending = [root]

  for (let dir = pending.pop(); dir !== undefined && total <= limit; dir = pending.pop()) {
    let entries

    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const path = join(dir, entry.name)

      if (entry.isDirectory()) {
        pending.push(path)
      } else {
        total += await lstat(path).then(
          (stats) => stats.size,
          () => 0,
        )
      }
    }
  }

  return total
}
