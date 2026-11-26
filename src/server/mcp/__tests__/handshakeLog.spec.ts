// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { handshakeLogLine, handshakeMethod } from '#server/mcp/handshakeLog.ts'

/**
 * Builds a POST request to /mcp with a raw body.
 * @param {string} body - Raw body
 * @returns {Request} - Request
 */
const request = (body: string): Request =>
  new Request('http://localhost:3100/mcp', { method: 'POST', body })

describe('handshakeMethod', () => {
  it('recognises initialize and server/discover, also inside a batch', async () => {
    const discover = request(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'server/discover' }))
    const batch = request(
      JSON.stringify([
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      ]),
    )

    expect(await handshakeMethod(discover)).toBe('server/discover')
    expect(await handshakeMethod(batch)).toBe('initialize')
  })

  it('ignores other methods and unreadable bodies and leaves the body unread', async () => {
    const list = request(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }))

    expect(await handshakeMethod(list)).toBeNull()
    expect(await handshakeMethod(request('{'))).toBeNull()
    expect(await handshakeMethod(new Request('http://localhost:3100/mcp'))).toBeNull()
    expect(list.bodyUsed).toBe(false)
  })
})

describe('handshakeLogLine', () => {
  it('names the caller, the token id and the scopes on one line', () => {
    expect(
      handshakeLogLine(
        {
          actor: 'dev\nforged',
          via: 'token',
          tokenId: 3,
          clientLabel: 'laptop',
          scopes: ['sieb:read'],
        },
        'initialize',
      ),
    ).toBe('[sieb] MCP initialize by dev forged via token 3 (laptop), scopes sieb:read')
    expect(
      handshakeLogLine(
        { actor: 'alice', via: 'oauth', tokenId: null, clientLabel: 'claude.ai', scopes: [] },
        'server/discover',
      ),
    ).toBe('[sieb] MCP server/discover by alice via oauth (claude.ai), scopes none')
  })
})
