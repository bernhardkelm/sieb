import type { Context } from 'hono'

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/**
 * Escapes text for HTML element content and quoted attributes.
 * @param {string} text - Raw text
 * @returns {string} - Escaped text
 */
export const escapeHtml = (text: string): string =>
  text.replaceAll(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char)

/**
 * Answers a failed login with a small static page and a link that starts a new login. The page
 * loads nothing, may not be framed or cached, and carries only escaped text.
 * @param {Context} c - Request context
 * @param {400 | 403 | 503} status - Status code
 * @param {string} message - Plain text explanation
 * @returns {Response} - Response
 */
export const loginFailedPage = (c: Context, status: 400 | 403 | 503, message: string): Response => {
  c.header('Cache-Control', 'no-store')
  c.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'no-referrer')

  return c.html(
    `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>sieb login</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem}</style></head>
<body><h1>Login failed</h1><p>${escapeHtml(message)}</p><p><a href="/auth/login">Try again</a></p></body>
</html>`,
    status,
  )
}
