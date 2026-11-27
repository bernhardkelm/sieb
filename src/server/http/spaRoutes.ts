import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import type { Hono } from 'hono'

import type { AppEnv } from '#server/http/AppEnv.ts'

export const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'
export const REVALIDATE_CACHE = 'no-cache'

/**
 * Returns whether a request path is a client route: not an API, login, metrics, MCP, worker or well-known path, not a hashed
 * asset and no file extension in the last segment, so missing files stay 404.
 * @param {string} path - Request path
 * @returns {boolean} - True for client routes like /inbox or /cves
 */
export const isClientRoute = (path: string): boolean => {
  const reserved = ['/api', '/auth', '/metrics', '/assets', '/mcp', '/worker', '/.well-known']

  if (reserved.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return false
  }

  const lastSegment = path.slice(path.lastIndexOf('/') + 1)

  return !lastSegment.includes('.')
}

/**
 * Serves the built client after the API routes: files by their path, hashed files under assets/
 * cached for a year, and index.html for every client route so the history router can resolve it.
 * Reads index.html once and throws when it is missing.
 * @param {Hono<AppEnv>} app - App, after its API routes are mounted
 * @param {string} dir - Absolute path of the Vite build output
 * @returns {void}
 */
export const useSpa = (app: Hono<AppEnv>, dir: string): void => {
  const indexHtml = readFileSync(join(dir, 'index.html'), 'utf8')
  const files = serveStatic({ root: dir })

  app.use('*', async (c, next) => {
    const found = await files(c, next)

    if (found instanceof Response) {
      const cache = c.req.path.startsWith('/assets/') ? IMMUTABLE_CACHE : REVALIDATE_CACHE
      found.headers.set('Cache-Control', cache)
      return found
    }
  })

  app.get('*', (c) => {
    if (!isClientRoute(c.req.path)) {
      return c.notFound()
    }

    c.header('Cache-Control', REVALIDATE_CACHE)
    return c.html(indexHtml)
  })
}
