import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

import { errorMessage } from '#checker/safeText.ts'
import { CHECK_DIR_PREFIX } from '#checker/workspace/checkLayout.ts'

/**
 * Removes a check directory, logging instead of throwing when that fails.
 * @param {string} dir - Check directory
 * @param {(line: string) => void} log - Log writer
 * @returns {Promise<void>}
 */
export const wipeCheckDir = async (dir: string, log: (line: string) => void): Promise<void> => {
  try {
    await rm(dir, { recursive: true, force: true, maxRetries: 2 })
  } catch (error) {
    log(`[sieb-checker] could not wipe ${dir}: ${errorMessage(error)}`)
  }
}

/**
 * Removes check directories a previous worker process left behind.
 * @param {string} workdir - Work directory
 * @param {(line: string) => void} log - Log writer
 * @returns {Promise<void>}
 */
export const wipeStaleChecks = async (
  workdir: string,
  log: (line: string) => void,
): Promise<void> => {
  const entries = await readdir(workdir)

  for (const entry of entries.filter((name) => name.startsWith(CHECK_DIR_PREFIX))) {
    await wipeCheckDir(join(workdir, entry), log)
  }
}
