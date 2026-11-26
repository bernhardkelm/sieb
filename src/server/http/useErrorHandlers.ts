import type { Hono } from 'hono'

import type { ErrorBody } from '#core/apiTypes.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { logSafe } from '#server/logSafe.ts'

/**
 * Sets the fallbacks: a JSON 404 for unknown paths and a logged JSON 500 for thrown errors.
 * @param {Hono<AppEnv>} app - App, after every route is mounted
 * @param {(message: string) => void} log - Logger for failed requests
 * @returns {void}
 */
export const useErrorHandlers = (app: Hono<AppEnv>, log: (message: string) => void): void => {
  app.notFound((c) => c.json<ErrorBody>({ error: 'not_found' }, 404))
  app.onError((error, c) => {
    log(`[sieb] request ${c.req.method} ${logSafe(c.req.path)} failed: ${logSafe(error.message)}`)
    return c.json<ErrorBody>({ error: 'internal_error' }, 500)
  })
}
