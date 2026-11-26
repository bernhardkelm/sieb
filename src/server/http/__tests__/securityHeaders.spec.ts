// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { oidcTestApp, send } from '#server/auth/oidc/__tests__/oidcTestApp.ts'
import { createApp } from '#server/http/createApp.ts'

import { testAppDeps } from './appFixtures.ts'

const staticDir = mkdtempSync(join(tmpdir(), 'sieb-headers-dist-'))

mkdirSync(join(staticDir, 'assets'))
writeFileSync(join(staticDir, 'index.html'), '<div id="app"></div>')
writeFileSync(join(staticDir, 'assets', 'index-abc.js'), 'export {}')

afterAll(() => {
  rmSync(staticDir, { recursive: true, force: true })
})

/**
 * Asserts the headers every response carries.
 * @param {Response} response - Response
 * @returns {void}
 */
const expectHardened = (response: Response): void => {
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'")
}

describe('securityHeaders', () => {
  it('marks the SPA, its assets, the API, metrics and 404s unframeable and nosniff', async () => {
    const app = createApp(testAppDeps({ staticDir }))
    const index = await app.request('/inbox')
    const asset = await app.request('/assets/index-abc.js')

    expect(index.status).toBe(200)
    expect(await index.text()).toContain('id="app"')
    expect(asset.status).toBe(200)
    expect(asset.headers.get('Content-Type')).toContain('javascript')
    expect(asset.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'none'")

    for (const response of [
      index,
      asset,
      await app.request('/api/health'),
      await app.request('/metrics'),
      await app.request('/api/nope'),
      await app.request('http://evil.example/api/health/x'),
    ]) {
      expectHardened(response)
    }
  })

  it('keeps a route policy and adds frame-ancestors to it', async () => {
    const { app } = await oidcTestApp()
    const page = await send(app, '/auth/callback?error=access_denied')
    const redirect = await send(app, '/')

    expect(page.headers.get('Content-Security-Policy')).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
    )
    expectHardened(redirect)
  })
})
