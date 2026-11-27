import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import type { ErrorBody } from '#core/errorApiTypes.ts'
import type { CheckContext } from '#server/checks/checkContext.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { pathGuard } from '#server/http/pathGuard.ts'
import { createWorkerRoutes } from '#server/http/routes/workerRoutes.ts'
import { securityHeaders } from '#server/http/securityHeaders.ts'
import { useErrorHandlers } from '#server/http/useErrorHandlers.ts'
import { workerAuth } from '#server/http/workerAuth.ts'

/** Largest worker body, a result with a reply of MAX_CHECK_REPLY_LENGTH fits several times */
export const MAX_WORKER_BODY_BYTES = 32 * 1024

export interface WorkerAppDeps {
  context: CheckContext
  secret: string // SIEB_WORKER_SECRET
  log?: (message: string) => void
}

/**
 * Creates the app of the worker listener (SIEB_WORKER_PORT): only the /worker routes behind
 * the worker secret and a JSON 404 for the rest. There is no Host check, the worker reaches it
 * by service name and a page that rebinds DNS cannot know the secret.
 * @param {WorkerAppDeps} deps - Check context, worker secret, logger
 * @returns {Hono<AppEnv>} - App
 */
export const createWorkerApp = ({
  context,
  secret,
  log = console.error,
}: WorkerAppDeps): Hono<AppEnv> => {
  const app = new Hono<AppEnv>()

  app.use('*', securityHeaders())
  app.use('*', pathGuard())
  app.use(
    '/worker/*',
    workerAuth(secret, () => context.presence.seen(context.clock())),
  )
  app.use(
    '/worker/*',
    bodyLimit({
      maxSize: MAX_WORKER_BODY_BYTES,
      onError: (c) => c.json<ErrorBody>({ error: 'payload_too_large' }, 413),
    }),
  )
  app.route('/worker', createWorkerRoutes(context))
  useErrorHandlers(app, log, 'worker request')

  return app
}
