import { createHash, timingSafeEqual } from 'node:crypto'

import type { MiddlewareHandler } from 'hono'

import type { ErrorBody } from '#core/apiTypes.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'

const BEARER_PREFIX = 'Bearer '

/**
 * Hashes a secret to a fixed length, so comparing two of them takes the same time whatever
 * their lengths are.
 * @param {string} value - Secret or presented value
 * @returns {Buffer} - sha-256 digest
 */
const digestOf = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest()

/**
 * Returns whether an Authorization header carries the worker secret, compared in constant time.
 * @param {string | undefined} header - Authorization header value
 * @param {string} secret - SIEB_WORKER_SECRET
 * @returns {boolean} - True for Bearer and exactly the secret
 */
export const isWorkerAuthorized = (header: string | undefined, secret: string): boolean => {
  if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
    return false
  }

  return timingSafeEqual(digestOf(header.slice(BEARER_PREFIX.length)), digestOf(secret))
}

/**
 * Creates the middleware that answers 401 for worker requests without the worker secret and
 * records every authenticated request as a sign of life.
 * @param {string} secret - SIEB_WORKER_SECRET
 * @param {() => void} seen - Records the authenticated request
 * @returns {MiddlewareHandler<AppEnv>} - Middleware for /worker
 */
export const workerAuth =
  (secret: string, seen: () => void): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    if (!isWorkerAuthorized(c.req.header('authorization'), secret)) {
      c.header('WWW-Authenticate', 'Bearer')
      return c.json<ErrorBody>({ error: 'unauthorized' }, 401)
    }

    seen()
    await next()
  }
