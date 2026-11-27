import type { MiddlewareHandler } from 'hono'

import type { ErrorBody } from '#core/errorApiTypes.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { isWorkerAuthorized } from '#server/http/workerAuth.ts'

const FETCHER_PATH = /^\/worker\/checks\/[^/]+\/(?:access|source)\/?$/u

/**
 * Returns whether a worker listener path is one of the fetcher routes, which hand out credentials.
 * @param {string} path - Request path
 * @returns {boolean} - True for /worker/checks/:id/access and /worker/checks/:id/source
 */
export const isFetcherPath = (path: string): boolean => FETCHER_PATH.test(path)

/**
 * Creates the middleware of the fetcher routes: 404 without SIEB_FETCHER_SECRET, 401 without
 * exactly that secret. The worker secret never passes, so the checker that runs Claude cannot
 * ask for credentials, and fetcher requests are no sign of life of the worker.
 * @param {string | null} secret - SIEB_FETCHER_SECRET, null while it is unset
 * @returns {MiddlewareHandler<AppEnv>} - Middleware for the fetcher routes
 */
export const fetcherAuth =
  (secret: string | null): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    if (secret === null) {
      return c.json<ErrorBody>({ error: 'not_found' }, 404)
    }

    if (!isWorkerAuthorized(c.req.header('authorization'), secret)) {
      c.header('WWW-Authenticate', 'Bearer')
      return c.json<ErrorBody>({ error: 'unauthorized' }, 401)
    }

    await next()
  }
