// @vitest-environment node
import { request } from 'node:http'
import type { AddressInfo } from 'node:net'

import { serve, type ServerType } from '@hono/node-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '#server/http/createApp.ts'
import { hasDotSegment } from '#server/http/pathGuard.ts'

import { testAppDeps } from './appFixtures.ts'

let server: ServerType
let port = 0

beforeAll(async () => {
  const app = createApp(testAppDeps({ devUser: null, mcpEnabled: true }))

  await new Promise<void>((resolve) => {
    server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 }, () => {
      resolve()
    })
  })
  port = (server.address() as AddressInfo).port
})

afterAll(() => {
  server.close()
})

/**
 * Sends a raw request target to the listening app, unnormalised.
 * @param {string} target - Request target as written on the wire
 * @param {Record<string, string>} headers - Extra headers
 * @returns {Promise<{ status: number; body: string }>} - Status and body
 */
const raw = (
  target: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const req = request(
      { host: '127.0.0.1', port, path: target, method: 'GET', headers },
      (res) => {
        let body = ''
        res.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body })
        })
      },
    )

    req.on('error', reject)
    req.end()
  })

describe('pathGuard over a real listener', () => {
  it.each([
    '/mcp/%2e%2e/api/me',
    '/mcp/%2E%2E/api/me',
    '/mcp/../api/me',
    '/mcp/.%2e/api/me',
    '/mcp/%2e./api/me',
    '/mcp/./../api/me',
    '/mcp/%2e/x',
    '/mcp%2f..%2fapi/me',
    '/mcp/..%5capi/me',
    '/.well-known/oauth-protected-resource/%2e%2e/%2e%2e/api/me?x=1',
  ])('answers 400 for %s before identity', async (target) => {
    const response = await raw(target, { 'X-authentik-username': 'mallory' })

    expect(response.status).toBe(400)
    expect(JSON.parse(response.body)).toEqual({ error: 'invalid_path' })
  })

  it('gets a 400 for backslash targets, the Node adapter refuses those itself', async () => {
    expect((await raw('/mcp\\..\\api/me', { 'X-authentik-username': 'mallory' })).status).toBe(400)
  })

  it('lets ordinary targets through, dots inside segments and in the query included', async () => {
    const me = await raw('/api/me?return=../x', { 'X-authentik-username': 'alice' })

    expect(me.status).toBe(200)
    expect(JSON.parse(me.body)).toEqual({ username: 'alice', authMode: 'header' })
    expect((await raw('/api/findings/a..b')).status).toBe(404)
    expect((await raw('/api/health')).status).toBe(200)
  })
})

describe('hasDotSegment', () => {
  it('finds literal and encoded dot segments only', () => {
    expect(hasDotSegment('/a/../b')).toBe(true)
    expect(hasDotSegment('/a/%2E%2e')).toBe(true)
    expect(hasDotSegment('/a/.')).toBe(true)
    expect(hasDotSegment('http://host/a/../b')).toBe(true)
    expect(hasDotSegment('/a/...')).toBe(false)
    expect(hasDotSegment('/a/.b/c.')).toBe(false)
    expect(hasDotSegment('/a?b=/../')).toBe(false)
    expect(hasDotSegment('/')).toBe(false)
  })
})
