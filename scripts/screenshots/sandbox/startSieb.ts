import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { openSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'

import { pollFor, stopProcess } from '#scripts/screenshots/processes.ts'

export interface SiebSandbox {
  url: string
  workerUrl: string
  workerSecret: string
  logFile: string
  stop: () => Promise<void>
}

export interface SandboxOptions {
  repoRoot: string
  workDir: string // holds dist/, the database and the server log
  dbPath: string
  credentialsKey: Buffer
  user: string
}

const HOST = '127.0.0.1'
const PUBLIC_URL = 'https://sieb.example.com' // only appears in links and texts, never requested
const START_TIMEOUT_MS = 30_000

/**
 * Asks the operating system for a free loopback port.
 * @returns {Promise<number>} - Port that was free a moment ago
 */
const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer()

    server.once('error', reject)
    server.listen(0, HOST, () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0

      server.close(() => resolve(port))
    })
  })

/**
 * Returns a random secret for the worker and fetcher listeners.
 * @returns {string} - 64 hex characters
 */
const secret = (): string => randomBytes(32).toString('hex')

/**
 * Starts sieb in mock mode on free loopback ports with its own database, the built client from
 * workDir/dist, MCP, Auto-check and private access switched on, and the KEV catalog read from the
 * fixtures. The environment is built from scratch, so no .env.local or shell setting leaks in.
 * @param {SandboxOptions} options - Paths, credentials key and acting user
 * @returns {Promise<SiebSandbox>} - URLs, the worker secret and a stop function
 * @throws {Error} - When the server does not answer in time
 */
export const startSieb = async (options: SandboxOptions): Promise<SiebSandbox> => {
  const port = await freePort()
  const workerPort = await freePort()
  const url = `http://${HOST}:${port}`
  const workerSecret = secret()
  const logFile = join(options.workDir, 'server.log')
  const log = openSync(logFile, 'a')
  const inherited = ['PATH', 'HOME', 'TZ'].flatMap((name) => {
    const value = process.env[name]

    return value === undefined ? [] : [[name, value]]
  })
  const env = {
    ...Object.fromEntries(inherited),
    SIEB_SOURCE: 'mock',
    SIEB_DB_PATH: options.dbPath,
    SIEB_HOST: HOST,
    SIEB_PORT: String(port),
    SIEB_DEV_USER: options.user,
    SIEB_SYNC_INTERVAL_MINUTES: '1440',
    SIEB_KEV_SOURCE: 'cisa',
    SIEB_MCP_ENABLED: 'true',
    SIEB_PUBLIC_URL: PUBLIC_URL,
    SIEB_CHECKS_ENABLED: 'true',
    SIEB_WORKER_PORT: String(workerPort),
    SIEB_WORKER_SECRET: workerSecret,
    SIEB_FETCHER_SECRET: secret(),
    SIEB_CREDENTIALS_KEY: options.credentialsKey.toString('base64'),
  }
  const child = spawn(process.execPath, [join(options.repoRoot, 'src/server/main.ts')], {
    cwd: options.workDir,
    env,
    stdio: ['ignore', log, log],
  })
  const stop = (): Promise<void> => stopProcess(child)

  try {
    await pollFor(
      async () => {
        if (child.exitCode !== null) {
          throw new Error(`sieb exited, see ${logFile}`)
        }

        return (await fetch(`${url}/api/health`)).ok ? true : null
      },
      START_TIMEOUT_MS,
      `sieb on ${url}, see ${logFile}`,
    )
  } catch (error) {
    await stop()
    throw error
  }

  return { url, workerUrl: `http://${HOST}:${workerPort}/worker`, workerSecret, logFile, stop }
}
