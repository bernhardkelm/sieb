import { stat } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'

import { realpathInside } from '#checker/workspace/insidePath.ts'

/** A path argument that is not a file inside the workspace */
export class OutsidePathError extends Error {
  /**
   * Creates the error for a rejected path.
   * @param {string} path - Path as the tool received it
   * @returns {void}
   */
  constructor(path: string) {
    super(`${JSON.stringify(path)} is not a file inside the workspace`)
    this.name = 'OutsidePathError'
  }
}

/**
 * Resolves a tool's path argument, relative to the workspace or absolute, with every symlink
 * followed, and accepts it only as a regular file inside the workspace.
 * @param {string} realRoot - Resolved workspace directory
 * @param {string} path - Path argument
 * @returns {Promise<{ path: string, size: number }>} - Resolved path and file size
 * @throws {OutsidePathError} - For a missing path, a path outside the workspace or a non-file
 */
export const workspaceFile = async (
  realRoot: string,
  path: string,
): Promise<{ path: string; size: number }> => {
  const candidate = path.includes('\0') ? null : isAbsolute(path) ? path : join(realRoot, path)
  const resolved = candidate === null ? null : await realpathInside(realRoot, candidate)
  const info = resolved === null ? null : await stat(resolved)

  if (resolved === null || !info?.isFile()) {
    throw new OutsidePathError(path)
  }

  return { path: resolved, size: info.size }
}
