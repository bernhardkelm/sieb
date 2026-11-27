import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

export interface ScreenshotOptions {
  outDir: string
  only: string[] | null // shot names, null for all
  keep: boolean // keeps the sandbox directory with database and server log
}

export const USAGE = `usage: npm run screenshots:generate -- [--out <dir>] [--only <name,...>] [--keep]
  --out   directory for the PNG files, default a new temporary directory
  --only  comma separated shot names, default all
  --keep  keep the sandbox directory (database, server log, Chrome profile)
  CHROME_PATH overrides the Chrome or Chromium binary`

/**
 * Reads the command line options of the screenshot script.
 * @param {readonly string[]} args - Arguments after the script path
 * @param {string} cwd - Directory a relative --out resolves against
 * @returns {ScreenshotOptions} - Options
 * @throws {Error} - For unknown options
 */
export const readScreenshotOptions = (args: readonly string[], cwd: string): ScreenshotOptions => {
  const { values } = parseArgs({
    args: [...args],
    options: {
      out: { type: 'string' },
      only: { type: 'string' },
      keep: { type: 'boolean', default: false },
    },
    strict: true,
  })
  const only = values.only
    ?.split(',')
    .map((name) => name.trim())
    .filter(Boolean)

  return {
    outDir:
      values.out === undefined
        ? mkdtempSync(join(tmpdir(), 'sieb-screenshots-'))
        : resolve(cwd, values.out),
    only: only === undefined || only.length === 0 ? null : only,
    keep: values.keep,
  }
}
