// @vitest-environment node
import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { logIn, OIDC, oidcTestApp, send, sessionHeaders, type OidcTestApp } from './oidcTestApp.ts'

/**
 * Fetches the sign-in page with a query.
 * @param {OidcTestApp} test - Test app
 * @param {string} query - Query string including the question mark
 * @param {Record<string, string>} headers - Extra headers
 * @returns {Promise<{ response: Response; html: string }>} - Response and its body
 */
const signIn = async (
  test: OidcTestApp,
  query = '',
  headers: Record<string, string> = {},
): Promise<{ response: Response; html: string }> => {
  const response = await send(test.app, `/auth/signin${query}`, { headers })

  return { response, html: await response.text() }
}

/**
 * Reads the href of the sign-in button, HTML entities of the attribute decoded.
 * @param {string} html - Page body
 * @returns {string} - Button target
 */
const buttonHref = (html: string): string =>
  (/<a class="button" href="([^"]*)"/.exec(html)?.[1] ?? '').replaceAll('&#39;', "'")

describe('GET /auth/signin', () => {
  it('renders the mark, the title and a focused button that starts the login', async () => {
    const { response, html } = await signIn(await oidcTestApp(), '?return=%2Finbox%3Fa%3D1')

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toMatch(/^text\/html/)
    expect(html).toContain('<h1>sieb</h1>')
    expect(html).toContain('<svg class="mark"')
    expect(html).toMatch(
      /<a class="button" href="\/auth\/login\?return=%2Finbox%3Fa%3D1" autofocus>Sign in with SSO<\/a>/,
    )
    expect(html).not.toContain('signed out')
  })

  it('names the configured provider, escaped', async () => {
    const test = await oidcTestApp({ oidc: { ...OIDC, displayName: '<b>Example & "ID"</b>' } })
    const { html } = await signIn(test)

    expect(html).toContain('Sign in with &lt;b&gt;Example &amp; &quot;ID&quot;&lt;/b&gt;</a>')
  })

  it('shows the signed-out note with signedOut=1 only', async () => {
    const test = await oidcTestApp()

    expect((await signIn(test, '?signedOut=1')).html).toContain(
      '<p>You are signed out of sieb.</p>',
    )
    expect((await signIn(test, '?signedOut=yes')).html).not.toContain('signed out')
  })

  it('escapes the return path in the button', async () => {
    const raw = `/x"><script>alert(1)</script>'`
    const { html } = await signIn(await oidcTestApp(), `?return=${encodeURIComponent(raw)}`)

    expect(html).not.toContain('<script')
    expect(html).toContain('%3Cscript%3Ealert(1)%3C%2Fscript%3E&#39;"')
    expect(buttonHref(html)).toBe(`/auth/login?return=${encodeURIComponent(raw)}`)
  })

  it('carries a strict policy that admits only its own stylesheet and loads nothing', async () => {
    const { response, html } = await signIn(await oidcTestApp(), '?signedOut=1')
    const css = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? ''
    const hash = createHash('sha256').update(css).digest('base64')

    expect(response.headers.get('Content-Security-Policy')).toBe(
      `default-src 'none'; style-src 'sha256-${hash}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    )
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(html.match(/<style>/g)).toHaveLength(1)
    expect(html).not.toMatch(/<script|<link|<img|<iframe|\ssrc=|\sstyle=|url\(|@import|\/\/[a-z]/i)
  })

  it('sends a browser with a valid session straight to the return path', async () => {
    const test = await oidcTestApp()
    const { session } = await logIn(test)
    const { response } = await signIn(test, '?return=%2Finbox', sessionHeaders(session))

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/inbox')
  })
})
