// @vitest-environment node
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

import { WORKER_ONLINE_MS } from '#core/checkLimits.ts'
import { createWorkerPresence } from '#server/checks/checkContext.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { useErrorHandlers } from '#server/http/useErrorHandlers.ts'

describe('worker presence', () => {
  it('stays online for 90 seconds after the last worker request', () => {
    const presence = createWorkerPresence()
    const seen = new Date('2026-06-01T12:00:00.000Z')
    const after = (ms: number): Date => new Date(seen.getTime() + ms)

    expect(presence.online(seen)).toBe(false)
    presence.seen(seen)
    expect(presence.online(after(31_000))).toBe(true)
    expect(presence.online(after(WORKER_ONLINE_MS))).toBe(true)
    expect(presence.online(after(WORKER_ONLINE_MS + 1))).toBe(false)
  })
})

describe('useErrorHandlers', () => {
  it('logs the listener label with path and message escaped', async () => {
    const app = new Hono<AppEnv>()
    const logs: string[] = []

    app.get('*', () => {
      throw new Error('boom\nforged line')
    })
    useErrorHandlers(app, (line) => logs.push(line), 'worker request')

    const response = await app.request('/worker/x%0Aforged')

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'internal_error' })
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatch(/^\[sieb\] worker request GET /)
    expect(logs[0]).not.toContain('\n')
  })
})
