import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { errorMessage } from '#core/errorMessage.ts'

const execFileAsync = promisify(execFile)

/** Output limit, VulnerabilityReport lists reach several MB */
export const KUBECTL_MAX_BUFFER = 64 * 1024 * 1024

export const KUBECTL_TIMEOUT_MS = 120_000

/** Runs kubectl with arguments and resolves with its stdout */
export type KubectlRunner = (args: readonly string[]) => Promise<string>

/**
 * Runs kubectl without a shell and resolves with its stdout.
 * @param {readonly string[]} args - Arguments after "kubectl"
 * @returns {Promise<string>} - Standard output
 * @throws {Error} - When kubectl exits non-zero, times out or exceeds the buffer
 */
export const runKubectl: KubectlRunner = async (args) => {
  try {
    const { stdout } = await execFileAsync('kubectl', [...args], {
      maxBuffer: KUBECTL_MAX_BUFFER,
      timeout: KUBECTL_TIMEOUT_MS,
      encoding: 'utf8',
    })

    return stdout
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim()
    const message = errorMessage(error)

    throw new Error(`kubectl ${args.join(' ')} failed: ${stderr || message}`, { cause: error })
  }
}
