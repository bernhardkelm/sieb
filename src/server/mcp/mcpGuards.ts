import type { MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import type { ErrorBody } from '#core/apiTypes.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { isSameHostOrigin } from '#server/http/writeGuard.ts'

export const MCP_MAX_BODY_BYTES = 128 * 1024

export const MCP_RATE_LIMIT = 120

export const MCP_RATE_WINDOW_MS = 60 * 1000

export const PROPOSE_RATE_LIMIT = 30

export const PROPOSE_RATE_WINDOW_MS = 60 * 60 * 1000

/**
 * Returns whether a present Origin header may reach /mcp: the requested host or an allowlisted
 * origin. The opaque null origin and malformed values are refused.
 * @param {string} origin - Origin header value
 * @param {string} host - Host header value
 * @param {readonly string[]} allowed - Normalised origins from SIEB_MCP_ALLOWED_ORIGINS
 * @returns {boolean} - True when allowed
 */
export const isAllowedMcpOrigin = (
  origin: string,
  host: string,
  allowed: readonly string[],
): boolean => {
  if (isSameHostOrigin(origin, host)) {
    return true
  }

  return URL.canParse(origin) && allowed.includes(new URL(origin).origin)
}

/**
 * Creates the middleware that answers 403 for browser requests from a foreign origin. Clients
 * outside a browser send no Origin and pass.
 * @param {readonly string[]} allowed - Normalised origins besides the requested host
 * @returns {MiddlewareHandler<AppEnv>} - Middleware for /mcp
 */
export const mcpOriginGuard =
  (allowed: readonly string[]): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const origin = c.req.header('origin')
    const host = c.req.header('host') ?? new URL(c.req.url).host

    if (origin !== undefined && !isAllowedMcpOrigin(origin, host, allowed)) {
      return c.json<ErrorBody>({ error: 'forbidden_origin' }, 403)
    }

    await next()
  }

/**
 * Creates the middleware that answers 413 for /mcp bodies over MCP_MAX_BODY_BYTES.
 * @returns {MiddlewareHandler<AppEnv>} - Middleware for /mcp
 */
export const mcpBodyLimit = (): MiddlewareHandler<AppEnv> =>
  bodyLimit({
    maxSize: MCP_MAX_BODY_BYTES,
    onError: (c) => c.json<ErrorBody>({ error: 'payload_too_large' }, 413),
  })

export interface RateLimiter {
  /**
   * Counts a request of a caller in its current window.
   * @param {string} key - Caller key
   * @param {number} nowMs - Current time in ms
   * @returns {number | null} - Seconds until the window resets when over the limit, else null
   */
  hit: (key: string, nowMs: number) => number | null
}

/**
 * Creates a fixed-window rate limiter kept in memory, windows of idle callers are dropped.
 * @param {number} limit - Requests allowed per window
 * @param {number} windowMs - Window length in ms
 * @returns {RateLimiter} - Limiter
 */
export const createRateLimiter = (
  limit = MCP_RATE_LIMIT,
  windowMs = MCP_RATE_WINDOW_MS,
): RateLimiter => {
  const windows = new Map<string, { start: number; count: number }>()

  return {
    hit: (key, nowMs) => {
      for (const [other, window] of windows) {
        if (nowMs - window.start >= windowMs) {
          windows.delete(other)
        }
      }

      const window = windows.get(key) ?? { start: nowMs, count: 0 }

      window.count += 1
      windows.set(key, window)

      return window.count > limit ? Math.ceil((window.start + windowMs - nowMs) / 1000) : null
    },
  }
}
