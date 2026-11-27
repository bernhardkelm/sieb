import { realpath } from 'node:fs/promises'
import { sep } from 'node:path'

/**
 * Returns whether a resolved path is a directory or lies below it.
 * @param {string} realRoot - Resolved directory
 * @param {string} target - Resolved path
 * @returns {boolean} - Whether target is realRoot or inside it
 */
export const isInside = (realRoot: string, target: string): boolean =>
  target === realRoot || target.startsWith(`${realRoot}${sep}`)

/**
 * Resolves a path with every symlink followed and checks that it stays inside a directory.
 * @param {string} realRoot - Resolved directory
 * @param {string} path - Path to resolve
 * @returns {Promise<string | null>} - Resolved path, null when it does not exist or leads outside
 */
export const realpathInside = async (realRoot: string, path: string): Promise<string | null> => {
  try {
    const target = await realpath(path)

    return isInside(realRoot, target) ? target : null
  } catch {
    return null
  }
}
