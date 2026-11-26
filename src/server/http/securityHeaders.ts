import type { MiddlewareHandler } from 'hono'

import type { AppEnv } from '#server/http/AppEnv.ts'

const FRAME_ANCESTORS = "frame-ancestors 'none'"

/**
 * Creates the middleware that marks every response as not frameable and not to be MIME sniffed.
 * A Content-Security-Policy a route set itself keeps its directives and gains frame-ancestors.
 * @returns {MiddlewareHandler<AppEnv>} - Middleware, mounted first
 */
export const securityHeaders = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  await next()

  try {
    c.res.headers.set('X-Content-Type-Options', 'nosniff')
  } catch {
    c.res = new Response(c.res.body, c.res)
    c.res.headers.set('X-Content-Type-Options', 'nosniff')
  }

  const policy = c.res.headers.get('Content-Security-Policy')

  c.res.headers.set(
    'Content-Security-Policy',
    policy === null ? FRAME_ANCESTORS : `${policy}; ${FRAME_ANCESTORS}`,
  )
}
