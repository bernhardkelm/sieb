import { realpath } from 'node:fs/promises'

import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'

import { errorMessage } from '#core/errorMessage.ts'
import { createInspectServer } from '#checker/inspect/createInspectServer.ts'
import { execCommand } from '#checker/inspect/execCommand.ts'
import { createInspectHandlers } from '#checker/inspect/inspectHandlers.ts'
import { printable } from '#checker/safeText.ts'

const TIMEOUT_MS = 30_000
const MAX_OUTPUT_BYTES = 64 * 1024
const DEFAULT_PATH = '/usr/local/bin:/usr/bin:/bin'

/**
 * Serves the inspect tools over stdio for the workspace named by the first argument. stdout
 * carries the protocol, so nothing else is written there.
 * @returns {Promise<void>}
 * @throws {Error} - When the workspace argument is missing or does not exist
 */
const main = async (): Promise<void> => {
  const workspace = process.argv[2]

  if (!workspace) {
    throw new Error('usage: inspectMain.ts <workspace>')
  }

  const handlers = createInspectHandlers({
    root: await realpath(workspace),
    exec: execCommand,
    path: process.env.PATH || DEFAULT_PATH,
    timeoutMs: TIMEOUT_MS,
    maxBytes: MAX_OUTPUT_BYTES,
  })

  await createInspectServer(handlers).connect(new StdioServerTransport())
}

main().catch((error: unknown) => {
  console.error(`[sieb-inspect] ${printable(errorMessage(error))}`)
  process.exitCode = 1
})
