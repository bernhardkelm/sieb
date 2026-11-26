// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { createApp } from '#server/http/createApp.ts'

import { testAppDeps } from './appFixtures.ts'

const staticDir = mkdtempSync(join(tmpdir(), 'sieb-dist-'))

mkdirSync(join(staticDir, 'assets'))
writeFileSync(join(staticDir, 'index.html'), '<div id="app"></div>')
writeFileSync(join(staticDir, 'assets', 'index-abc.js'), 'export {}')

afterAll(() => {
  rmSync(staticDir, { recursive: true, force: true })
})

describe('createApp', () => {
  it('answers the health check with the source', async () => {
    const response = await createApp(testAppDeps()).request('/api/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok', source: 'mock' })
  })

  it('returns a JSON 404 for unknown API paths', async () => {
    const response = await createApp(testAppDeps({ staticDir })).request('/api/nope')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'not_found' })
  })

  it('serves index.html for client routes', async () => {
    const response = await createApp(testAppDeps({ staticDir })).request('/inbox?finding=1')

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('id="app"')
  })

  it('serves hashed assets with a long cache and keeps missing files 404', async () => {
    const app = createApp(testAppDeps({ staticDir }))
    const asset = await app.request('/assets/index-abc.js')
    const missing = await app.request('/assets/missing.js')

    expect(asset.status).toBe(200)
    expect(asset.headers.get('Cache-Control')).toContain('immutable')
    expect(missing.status).toBe(404)
  })

  it('never falls back to the SPA for /metrics and API paths', async () => {
    const app = createApp(testAppDeps({ staticDir }))
    const metrics = await app.request('/metrics')

    expect(metrics.headers.get('Content-Type')).toContain('text/plain; version=0.0.4')
    expect((await app.request('/api/findings/999')).status).toBe(404)
  })
})
