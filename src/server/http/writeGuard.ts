import type { MiddlewareHandler } from 'hono'

import type { ErrorBody } from '#core/apiTypes.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']

const ALLOWED_FETCH_SITES = ['same-origin', 'none']

/**
 * Returns whether a Content-Type header names JSON, parameters like charset ignored.
 * @param {string | undefined} contentType - Header value
 * @returns {boolean} - True for application/json
 */
export const isJsonContentType = (contentType: string | undefined): boolean =>
  (contentType ?? '').split(';')[0]?.trim().toLowerCase() === 'application/json'

/**
 * Returns whether an Origin header names the requested host. Only the host is compared, the
 * scheme differs behind a TLS-terminating proxy.
 * @param {string} origin - Origin header value
 * @param {string} host - Host header value
 * @returns {boolean} - True for a same-host origin, false for null and malformed origins
 */
export const isSameHostOrigin = (origin: string, host: string): boolean => {
  try {
    return new URL(origin).host === host.trim().toLowerCase()
  } catch {
    return false
  }
}

/**
 * Creates the middleware that protects writes against cross-site requests: every write must
 * send Content-Type application/json, which a form or a no-cors fetch cannot without a CORS
 * preflight (415 otherwise), a present Sec-Fetch-Site must be same-origin or none, and a
 * present Origin must name the requested host (403 otherwise).
 * @returns {MiddlewareHandler<AppEnv>} - Middleware for /api
 */
export const writeGuard = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  if (SAFE_METHODS.includes(c.req.method)) {
    await next()
    return
  }

  if (!isJsonContentType(c.req.header('content-type'))) {
    return c.json<ErrorBody>({ error: 'unsupported_media_type' }, 415)
  }

  const fetchSite = c.req.header('sec-fetch-site')
  const origin = c.req.header('origin')
  const host = c.req.header('host') ?? new URL(c.req.url).host

  if (
    (fetchSite !== undefined && !ALLOWED_FETCH_SITES.includes(fetchSite)) ||
    (origin !== undefined && !isSameHostOrigin(origin, host))
  ) {
    return c.json<ErrorBody>({ error: 'cross_site_request' }, 403)
  }

  await next()
}
