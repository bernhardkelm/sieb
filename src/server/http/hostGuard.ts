import type { MiddlewareHandler } from 'hono'

import type { ErrorBody } from '#core/errorApiTypes.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'

const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]']

/** Read-only paths scraped or probed by pod IP, so they skip the Host check */
export const HOST_EXEMPT_PATHS = ['/metrics', '/api/health']

/**
 * Splits the hostname off a Host value, keeping the brackets of an IPv6 literal.
 * @param {string} host - Host header value, lower case
 * @returns {string} - Hostname without port
 */
const hostnameOf = (host: string): string =>
  host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : (host.split(':')[0] ?? '')

/**
 * Returns whether a Host value may reach sieb: a loopback name on any port, which a DNS
 * rebinding page cannot send, or a configured entry. An entry with a port must match exactly,
 * one without matches that hostname on any port.
 * @param {string} host - Host header value
 * @param {readonly string[]} allowed - Configured entries, lower case
 * @returns {boolean} - True when allowed
 */
export const isAllowedHost = (host: string, allowed: readonly string[]): boolean => {
  const value = host.trim().toLowerCase()
  const hostname = hostnameOf(value)

  if (hostname === '') {
    return false
  }

  return (
    LOOPBACK_HOSTNAMES.includes(hostname) ||
    allowed.some((entry) => entry === value || entry === hostname)
  )
}

/**
 * Creates the middleware that answers 403 for requests whose Host is not allowed, the defence
 * against DNS rebinding. The exempt paths are read-only and reached by pod IP in the cluster.
 * @param {readonly string[]} allowed - Hosts besides loopback, from SIEB_ALLOWED_HOSTS
 * @returns {MiddlewareHandler<AppEnv>} - Middleware
 */
export const hostGuard =
  (allowed: readonly string[]): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const host = c.req.header('host') ?? new URL(c.req.url).host

    if (!HOST_EXEMPT_PATHS.includes(c.req.path) && !isAllowedHost(host, allowed)) {
      return c.json<ErrorBody>({ error: 'forbidden_host' }, 403)
    }

    await next()
  }
