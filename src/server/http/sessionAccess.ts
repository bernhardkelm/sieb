import { isClientRoute } from '#server/http/spaRoutes.ts'

/** Files of public/ a browser fetches without credentials, before or around the login */
export const PUBLIC_STATIC_FILES = [
  '/favicon.ico',
  '/favicon.svg',
  '/favicon-light.svg',
  '/favicon-dark.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/site.webmanifest',
]

const PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource'

const PAGE_METHODS = ['GET', 'HEAD']

/** How the oidc session guard treats a request without a session */
export type SessionAccess = 'public' | 'api' | 'page' | 'other'

/**
 * Returns whether a path is the path itself or below it.
 * @param {string} path - Request path
 * @param {string} prefix - Path prefix without trailing slash
 * @returns {boolean} - True for the prefix and its sub paths
 */
const isUnder = (path: string, prefix: string): boolean =>
  path === prefix || path.startsWith(`${prefix}/`)

/**
 * Classifies a request for the oidc session guard. Public: the login routes, the health check,
 * /mcp and its protected resource metadata while MCP is enabled (they authenticate by bearer
 * token), and the icons of public/. Everything else needs a session: /api answers 401, page
 * navigations redirect to the sign-in page, other files answer 401.
 * @param {string} method - HTTP method
 * @param {string} path - Request path as routed
 * @param {boolean} mcpEnabled - Whether /mcp and its metadata are mounted
 * @returns {SessionAccess} - Treatment without a session
 */
export const sessionAccessOf = (
  method: string,
  path: string,
  mcpEnabled: boolean,
): SessionAccess => {
  if (
    isUnder(path, '/auth') ||
    path === '/api/health' ||
    PUBLIC_STATIC_FILES.includes(path) ||
    (mcpEnabled && (path === '/mcp' || isUnder(path, PROTECTED_RESOURCE_PATH)))
  ) {
    return 'public'
  }

  if (isUnder(path, '/api')) {
    return 'api'
  }

  return PAGE_METHODS.includes(method) && isClientRoute(path) ? 'page' : 'other'
}
