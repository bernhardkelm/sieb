import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import type { ErrorBody } from '#core/errorApiTypes.ts'
import type { CheckContext } from '#server/checks/checkContext.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { fetcherAuth, isFetcherPath } from '#server/http/fetcherAuth.ts'
import { pathGuard } from '#server/http/pathGuard.ts'
import { createFetcherRoutes } from '#server/http/routes/fetcherRoutes.ts'
import { createWorkerRoutes } from '#server/http/routes/workerRoutes.ts'
import { securityHeaders } from '#server/http/securityHeaders.ts'
import { useErrorHandlers } from '#server/http/useErrorHandlers.ts'
import { workerAuth } from '#server/http/workerAuth.ts'

/** Largest worker body, a result with a reply of MAX_CHECK_REPLY_LENGTH fits several times */
export const MAX_WORKER_BODY_BYTES = 32 * 1024

export interface WorkerAppDeps {
  context: CheckContext
  secret: string // SIEB_WORKER_SECRET
  fetcherSecret?: string | null // SIEB_FETCHER_SECRET, null answers the fetcher routes 404
  log?: (message: string) => void
}

/**
 * Creates the app of the worker listener (SIEB_WORKER_PORT): only the /worker routes and a
 * JSON 404 for the rest. The fetcher routes take only the fetcher secret, every other route
 * only the worker secret. There is no Host check, the worker reaches it by service name and a
 * page that rebinds DNS cannot know the secrets.
 * @param {WorkerAppDeps} deps - Check context, worker and fetcher secret, logger
 * @returns {Hono<AppEnv>} - App
 */
export const createWorkerApp = ({
  context,
  secret,
  fetcherSecret = null,
  log = console.error,
}: WorkerAppDeps): Hono<AppEnv> => {
  const app = new Hono<AppEnv>()
  const worker = workerAuth(secret, () => context.presence.seen(context.clock()))
  const fetcher = fetcherAuth(fetcherSecret)

  app.use('*', securityHeaders())
  app.use('*', pathGuard())
  app.use('/worker/*', (c, next) =>
    isFetcherPath(c.req.path) ? fetcher(c, next) : worker(c, next),
  )
  app.use(
    '/worker/*',
    bodyLimit({
      maxSize: MAX_WORKER_BODY_BYTES,
      onError: (c) => c.json<ErrorBody>({ error: 'payload_too_large' }, 413),
    }),
  )
  app.route('/worker', createFetcherRoutes(context))
  app.route('/worker', createWorkerRoutes(context))
  useErrorHandlers(app, log, 'worker request')

  return app
}
