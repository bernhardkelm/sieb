import { accessSync, constants } from 'node:fs'
import { delimiter, join } from 'node:path'

const MAC_APPS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
]

const LINUX_COMMANDS = [
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
  'chrome',
]

/**
 * Returns whether a file exists and is executable.
 * @param {string} path - File path
 * @returns {boolean} - True for an executable file
 */
const isExecutable = (path: string): boolean => {
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Returns the first command of a list found on PATH.
 * @param {readonly string[]} commands - Command names in order of preference
 * @param {string} path - PATH value
 * @returns {string | null} - Absolute path, null when none is found
 */
const onPath = (commands: readonly string[], path: string): string | null => {
  const dirs = path.split(delimiter).filter(Boolean)

  for (const command of commands) {
    const found = dirs.map((dir) => join(dir, command)).find(isExecutable)

    if (found !== undefined) {
      return found
    }
  }

  return null
}

/**
 * Finds a Chrome or Chromium binary: CHROME_PATH first, then the macOS app bundles, then the
 * usual Linux command names on PATH.
 * @param {Record<string, string | undefined>} env - Environment
 * @returns {string} - Path of the binary
 * @throws {Error} - When no browser is found or CHROME_PATH is not executable
 */
export const findChrome = (env: Record<string, string | undefined>): string => {
  const configured = env.CHROME_PATH?.trim()

  if (configured) {
    if (!isExecutable(configured)) {
      throw new Error(`CHROME_PATH ${configured} is not an executable file`)
    }

    return configured
  }

  const found = MAC_APPS.find(isExecutable) ?? onPath(LINUX_COMMANDS, env.PATH ?? '')

  if (found === null) {
    throw new Error('no Chrome or Chromium found, set CHROME_PATH to the browser binary')
  }

  return found
}
