import type { Hono } from 'hono'

import type { ErrorBody } from '#core/errorApiTypes.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { logSafe } from '#server/logSafe.ts'

/**
 * Sets the fallbacks: a JSON 404 for unknown paths and a logged JSON 500 for thrown errors, with
 * path and message escaped for the log.
 * @param {Hono<AppEnv>} app - App, after every route is mounted
 * @param {(message: string) => void} log - Logger for failed requests
 * @param {string} label - Listener named in the log line, such as "worker request"
 * @returns {void}
 */
export const useErrorHandlers = (
  app: Hono<AppEnv>,
  log: (message: string) => void,
  label = 'request',
): void => {
  app.notFound((c) => c.json<ErrorBody>({ error: 'not_found' }, 404))
  app.onError((error, c) => {
    log(`[sieb] ${label} ${c.req.method} ${logSafe(c.req.path)} failed: ${logSafe(error.message)}`)
    return c.json<ErrorBody>({ error: 'internal_error' }, 500)
  })
}
