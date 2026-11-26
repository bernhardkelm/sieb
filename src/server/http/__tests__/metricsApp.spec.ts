// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { createApp } from '#server/http/createApp.ts'
import { createMetricsApp } from '#server/http/metricsApp.ts'

import { testAppDeps } from './appFixtures.ts'

const staticDir = mkdtempSync(join(tmpdir(), 'sieb-dist-'))

writeFileSync(join(staticDir, 'index.html'), '<div id="app"></div>')

afterAll(() => {
  rmSync(staticDir, { recursive: true, force: true })
})

describe('createMetricsApp', () => {
  it('serves /metrics for any Host and nothing else', async () => {
    const { db, clock, kevSource } = testAppDeps()
    const app = createMetricsApp({ db, clock, kevSource, allowedHosts: ['sieb.example'] })
    const metrics = await app.request('http://10.42.0.7:9100/metrics')
    const api = await app.request('http://localhost:9100/api/findings')
    const foreign = await app.request('http://10.42.0.7:9100/other')

    expect(metrics.status).toBe(200)
    expect(metrics.headers.get('Content-Type')).toBe('text/plain; version=0.0.4; charset=utf-8')
    expect(await metrics.text()).toContain('sieb_')
    expect(api.status).toBe(404)
    expect(foreign.status).toBe(403)
  })
})

describe('header mode with a metrics port', () => {
  it('answers /metrics 404 on the main app and keeps the rest', async () => {
    const app = createApp(testAppDeps({ metricsOnMainPort: false, staticDir }))
    const metrics = await app.request('/metrics')

    expect(metrics.status).toBe(404)
    expect(await metrics.json()).toEqual({ error: 'not_found' })
    expect((await app.request('/api/findings')).status).toBe(200)
  })

  it('never serves the SPA or a login for /auth paths', async () => {
    const app = createApp(testAppDeps({ staticDir }))
    for (const path of ['/auth/login', '/auth/signin?return=%2F', '/auth/signin?signedOut=1']) {
      const response = await app.request(path)

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'not_found' })
    }
  })
})
