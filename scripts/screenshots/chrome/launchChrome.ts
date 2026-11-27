import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { connectCdp, type CdpClient } from '#scripts/screenshots/chrome/cdpClient.ts'
import { pollFor, stopProcess } from '#scripts/screenshots/processes.ts'

export interface ChromeSession {
  page: CdpClient
  stop: () => Promise<void>
}

const START_TIMEOUT_MS = 20_000

/**
 * Reads the DevTools port Chrome writes into its profile once it listens.
 * @param {string} profileDir - User data directory
 * @returns {Promise<number | null>} - Port, null while the file is missing
 */
const readDevToolsPort = async (profileDir: string): Promise<number | null> => {
  const port = Number(readFileSync(join(profileDir, 'DevToolsActivePort'), 'utf8').split('\n')[0])

  return Number.isInteger(port) && port > 0 ? port : null
}

/**
 * Starts headless Chrome on a free loopback DevTools port with a fresh profile and opens one page.
 * @param {string} binary - Chrome binary
 * @param {string} profileDir - Empty directory for the throwaway profile
 * @returns {Promise<ChromeSession>} - Page client and a stop function that kills the browser
 */
export const launchChrome = async (binary: string, profileDir: string): Promise<ChromeSession> => {
  mkdirSync(profileDir, { recursive: true })

  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--hide-scrollbars',
    '--font-render-hinting=none',
    '--lang=en-US',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
    'about:blank',
  ]
  const child = spawn(binary, args, {
    stdio: 'ignore',
    env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', LANGUAGE: 'en_US' },
  })
  const stop = (): Promise<void> => stopProcess(child)

  try {
    const port = await pollFor(() => readDevToolsPort(profileDir), START_TIMEOUT_MS, 'Chrome')
    const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
      method: 'PUT',
    })
    const target = (await response.json()) as { webSocketDebuggerUrl: string }
    const page = await connectCdp(target.webSocketDebuggerUrl)

    return {
      page,
      stop: async () => {
        page.close()
        await stop()
      },
    }
  } catch (error) {
    await stop()
    throw error
  }
}
