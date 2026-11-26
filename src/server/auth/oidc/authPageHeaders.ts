import { createHash } from 'node:crypto'

import type { Context } from 'hono'

/**
 * Returns the CSP source that admits exactly one inline stylesheet.
 * @param {string} css - Text between the style tags, byte for byte
 * @returns {string} - Quoted sha256 hash source
 */
export const styleHashSource = (css: string): string =>
  `'sha256-${createHash('sha256').update(css, 'utf8').digest('base64')}'`

/**
 * Sets the headers of the server-rendered /auth pages: no caching, no framing, no referrer, and a
 * policy that loads nothing and runs no script, admitting only the page's own stylesheet by hash.
 * @param {Context} c - Request context
 * @param {string} styleSource - Hash source of the page stylesheet, from styleHashSource
 * @returns {void}
 */
export const setAuthPageHeaders = (c: Context, styleSource: string): void => {
  c.header('Cache-Control', 'no-store')
  c.header(
    'Content-Security-Policy',
    `default-src 'none'; style-src ${styleSource}; base-uri 'none'; form-action 'none'`,
  )
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'no-referrer')
}
