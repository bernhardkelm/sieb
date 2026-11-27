import { spawn } from 'node:child_process'
import { join } from 'node:path'

import { exited } from '#scripts/screenshots/processes.ts'

/**
 * Builds the client with Vite into a directory outside the repository, so the dist/ of the
 * working copy stays untouched.
 * @param {string} repoRoot - Repository root
 * @param {string} outDir - Target directory, emptied first
 * @returns {Promise<void>} - Resolves once the build succeeded
 * @throws {Error} - When the build fails
 */
export const buildClient = async (repoRoot: string, outDir: string): Promise<void> => {
  const vite = join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js')
  const child = spawn(
    process.execPath,
    [vite, 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'],
    { cwd: repoRoot, stdio: ['ignore', 'inherit', 'inherit'] },
  )

  await exited(child)

  if (child.exitCode !== 0) {
    throw new Error(`client build failed with exit code ${String(child.exitCode)}`)
  }
}
