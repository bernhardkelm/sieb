import { randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { errorMessage } from '#core/errorMessage.ts'
import { findChrome } from '#scripts/screenshots/chrome/findChrome.ts'
import { launchChrome, type ChromeSession } from '#scripts/screenshots/chrome/launchChrome.ts'
import { createPageDriver } from '#scripts/screenshots/chrome/pageDriver.ts'
import { buildClient } from '#scripts/screenshots/sandbox/buildClient.ts'
import { startSieb, type SiebSandbox } from '#scripts/screenshots/sandbox/startSieb.ts'
import { readScreenshotOptions, USAGE } from '#scripts/screenshots/screenshotOptions.ts'
import { seedCredentials } from '#scripts/screenshots/seed/seedCredentials.ts'
import { seedState } from '#scripts/screenshots/seed/seedState.ts'
import { createSiebApi } from '#scripts/screenshots/seed/siebApi.ts'
import { SHOTS } from '#scripts/screenshots/shotList.ts'
import { takeShots } from '#scripts/screenshots/takeShots.ts'

const USER = 'alice'
const OTHER_USER = 'bob'
const HEARTBEAT_MS = 10_000

/**
 * Generates the README and guide screenshots: builds the client into a temporary sandbox,
 * starts an isolated sieb in mock mode on free loopback ports with a throwaway database, seeds
 * it, drives headless Chrome through every shot in light and dark and stops everything again,
 * also on failure and Ctrl+C.
 * @returns {Promise<void>} - Resolves once all files are written
 */
const main = async (): Promise<void> => {
  const options = readScreenshotOptions(
    process.argv.slice(2),
    process.env.INIT_CWD ?? process.cwd(),
  )
  const shots = options.only === null ? SHOTS : SHOTS.filter((s) => options.only?.includes(s.name))
  const unknown = options.only?.filter((name) => !SHOTS.some((shot) => shot.name === name)) ?? []

  if (unknown.length > 0) {
    throw new Error(
      `unknown shots ${unknown.join(', ')}, known: ${SHOTS.map((s) => s.name).join(', ')}`,
    )
  }
  const chromeBinary = findChrome(process.env)
  const repoRoot = fileURLToPath(new URL('..', import.meta.url))
  const workDir = mkdtempSync(join(tmpdir(), 'sieb-screenshots-sandbox-'))
  const dbPath = join(workDir, 'sieb.db')
  const credentialsKey = randomBytes(32)
  let sandbox: SiebSandbox | null = null
  let chrome: ChromeSession | null = null
  let heartbeat: NodeJS.Timeout | undefined

  /**
   * Stops the heartbeat, Chrome and sieb, and removes the sandbox unless --keep is set.
   * @returns {Promise<void>} - Resolves once everything is stopped
   */
  const cleanUp = async (): Promise<void> => {
    clearInterval(heartbeat)
    await chrome?.stop()
    await sandbox?.stop()

    if (options.keep) {
      console.log(`[sieb] sandbox kept in ${workDir}`)
    } else {
      rmSync(workDir, { recursive: true, force: true })
    }
  }

  process.once('SIGINT', () => {
    void cleanUp().finally(() => process.exit(130))
  })

  try {
    console.log('[sieb] building the client')
    await buildClient(repoRoot, join(workDir, 'dist'))
    seedCredentials(dbPath, credentialsKey, { user: USER, otherUser: OTHER_USER })
    sandbox = await startSieb({ repoRoot, workDir, dbPath, credentialsKey, user: USER })

    const api = createSiebApi(sandbox)
    const seed = await seedState(api, OTHER_USER)
    const beat = `/checks/${seed.runningCheckId}/heartbeat`

    heartbeat = setInterval(() => {
      api.worker(beat, { phase: 'investigating' }).catch(() => undefined)
    }, HEARTBEAT_MS)
    chrome = await launchChrome(chromeBinary, join(workDir, 'chrome'))
    mkdirSync(options.outDir, { recursive: true })

    const page = await createPageDriver(chrome.page)
    const files = await takeShots(
      { page, baseUrl: sandbox.url, seed, outDir: options.outDir },
      shots,
    )

    console.log(`[sieb] ${files.length} screenshots in ${options.outDir}`)
  } finally {
    await cleanUp()
  }
}

main().catch((error: unknown) => {
  console.error(`[sieb] ${errorMessage(error)}`)
  console.error(USAGE)
  process.exitCode = 1
})
