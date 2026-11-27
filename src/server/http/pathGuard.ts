import type { MiddlewareHandler } from 'hono'

import type { ErrorBody } from '#core/errorApiTypes.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'

const ENCODED_SEPARATORS: [RegExp, string][] = [
  [/%2e/gi, '.'],
  [/%2f/gi, '/'],
  [/%5c/gi, '\\'],
]

/**
 * Returns whether a raw request target has a dot segment (. or ..), literal or percent-encoded
 * in any case, with slashes or backslashes as separators.
 * @param {string} target - Request target as sent, before URL normalisation
 * @returns {boolean} - True when a segment is . or ..
 */
export const hasDotSegment = (target: string): boolean => {
  const path = ENCODED_SEPARATORS.reduce(
    (value, [pattern, char]) => value.replace(pattern, char),
    target.split(/[?#]/)[0] ?? '',
  )

  return path.split(/[/\\]/).some((segment) => segment === '.' || segment === '..')
}

/**
 * Creates the first middleware of the app: answers 400 for a request whose raw target has a dot
 * segment. The Node adapter resolves them while building the URL, so /mcp/%2e%2e/api/me would
 * otherwise reach /api/me under a path an Ingress routed as /mcp. Reads the raw target of the
 * Node request; requests without one (app.request in tests) arrive normalised already.
 * @returns {MiddlewareHandler<AppEnv>} - Middleware
 */
export const pathGuard = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const incoming = (c.env as { incoming?: { url?: unknown } } | undefined)?.incoming
  const target = typeof incoming?.url === 'string' ? incoming.url : null

  if (target !== null && hasDotSegment(target)) {
    return c.json<ErrorBody>({ error: 'invalid_path' }, 400)
  }

  await next()
}
