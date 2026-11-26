// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { createApp } from '#server/http/createApp.ts'
import { isAllowedHost } from '#server/http/hostGuard.ts'

import { testAppDeps } from './appFixtures.ts'

/**
 * Sends a request to a fresh app and answers status and body.
 * @param {RequestInit & { path?: string }} init - Request, path defaults to POST /api/sync
 * @param {string[]} allowedHosts - Configured hosts
 * @returns {Promise<{ status: number; body: unknown }>} - Status and parsed body
 */
const send = async (
  { path = '/api/sync', ...init }: RequestInit & { path?: string },
  allowedHosts: string[] = [],
): Promise<{ status: number; body: unknown }> => {
  const response = await createApp(testAppDeps({ allowedHosts })).request(path, {
    method: 'POST',
    ...init,
  })
  const text = await response.text()

  return { status: response.status, body: text.startsWith('{') ? JSON.parse(text) : text }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

describe('write protection', () => {
  it('answers 415 for writes without a JSON content type', async () => {
    expect(await send({})).toEqual({ status: 415, body: { error: 'unsupported_media_type' } })
    expect(
      await send({ headers: { 'Content-Type': 'text/plain' }, body: '{"reason":"x"}' }),
    ).toMatchObject({ status: 415 })
    expect(
      await send({ headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'a=1' }),
    ).toMatchObject({ status: 415 })
  })

  it('answers 403 for cross-site writes', async () => {
    const crossSite = await send({
      headers: { ...JSON_HEADERS, 'Sec-Fetch-Site': 'cross-site' },
    })
    const sameSite = await send({ headers: { ...JSON_HEADERS, 'Sec-Fetch-Site': 'same-site' } })
    const foreignOrigin = await send({
      headers: { ...JSON_HEADERS, Origin: 'https://evil.example' },
    })
    const nullOrigin = await send({ headers: { ...JSON_HEADERS, Origin: 'null' } })

    expect(crossSite).toEqual({ status: 403, body: { error: 'cross_site_request' } })
    expect([sameSite.status, foreignOrigin.status, nullOrigin.status]).toEqual([403, 403, 403])
  })

  it('lets same-origin JSON writes through', async () => {
    const response = await send({
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Sec-Fetch-Site': 'same-origin',
        Origin: 'http://localhost',
      },
    })

    expect(response).toMatchObject({ status: 200, body: { status: 'success' } })
  })

  it('answers 413 for API bodies over 64 KiB', async () => {
    const body = JSON.stringify({ reason: 'x'.repeat(70 * 1024) })

    expect(await send({ path: '/api/decisions', headers: JSON_HEADERS, body })).toEqual({
      status: 413,
      body: { error: 'payload_too_large' },
    })
  })
})

describe('host allowlist', () => {
  it('accepts loopback names on any port and configured hosts', () => {
    expect(isAllowedHost('localhost:5173', [])).toBe(true)
    expect(isAllowedHost('127.0.0.1:3100', [])).toBe(true)
    expect(isAllowedHost('[::1]:3100', [])).toBe(true)
    expect(isAllowedHost('Sieb.example.com', ['sieb.example.com'])).toBe(true)
    expect(isAllowedHost('sieb.example.com:8443', ['sieb.example.com'])).toBe(true)
    expect(isAllowedHost('10.0.0.5:80', ['10.0.0.5:3100'])).toBe(false)
    expect(isAllowedHost('localhost.evil.example', [])).toBe(false)
    expect(isAllowedHost('', [])).toBe(false)
  })

  it('answers 403 for a foreign Host, except on /metrics and /api/health', async () => {
    const foreign = { host: 'rebind.evil.example:3100' }

    expect(await send({ method: 'GET', path: '/api/findings', headers: foreign })).toEqual({
      status: 403,
      body: { error: 'forbidden_host' },
    })
    expect((await send({ method: 'GET', path: '/metrics', headers: foreign })).status).toBe(200)
    expect((await send({ method: 'GET', path: '/api/health', headers: foreign })).status).toBe(200)
    expect(
      (
        await send(
          { method: 'GET', path: '/api/findings', headers: { host: 'sieb.example.com' } },
          ['sieb.example.com'],
        )
      ).status,
    ).toBe(200)
  })
})
