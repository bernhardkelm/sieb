// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { handshakeLogLine, readHandshake } from '#server/mcp/handshakeLog.ts'

/**
 * Builds a POST request to /mcp with a raw body.
 * @param {string} body - Raw body
 * @returns {Request} - Request
 */
const request = (body: string): Request =>
  new Request('http://localhost:3100/mcp', { method: 'POST', body })

describe('readHandshake', () => {
  it('recognises initialize and server/discover, also inside a batch', async () => {
    const discover = request(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'server/discover' }))
    const batch = request(
      JSON.stringify([
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      ]),
    )

    expect(await readHandshake(discover)).toEqual({ method: 'server/discover', clientName: null })
    expect(await readHandshake(batch)).toEqual({ method: 'initialize', clientName: null })
  })

  it('reads the client name of initialize and of the 2026 envelope', async () => {
    const initialize = request(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { clientInfo: { name: 'claude-code', version: '2.1.0' } },
      }),
    )
    const discover = request(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'server/discover',
        params: { _meta: { 'io.modelcontextprotocol/clientInfo': { name: ' claude-ai ' } } },
      }),
    )
    const odd = request(
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: 7 } }),
    )

    expect((await readHandshake(initialize))?.clientName).toBe('claude-code')
    expect((await readHandshake(discover))?.clientName).toBe('claude-ai')
    expect((await readHandshake(odd))?.clientName).toBeNull()
  })

  it('ignores other methods and unreadable bodies and leaves the body unread', async () => {
    const list = request(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }))

    expect(await readHandshake(list)).toBeNull()
    expect(await readHandshake(request('{'))).toBeNull()
    expect(await readHandshake(new Request('http://localhost:3100/mcp'))).toBeNull()
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
        { method: 'initialize', clientName: 'claude-code\nforged' },
      ),
    ).toBe(
      '[sieb] MCP initialize by dev forged via token 3 (laptop) from claude-code forged, scopes sieb:read',
    )
    expect(
      handshakeLogLine(
        { actor: 'alice', via: 'oauth', tokenId: null, clientLabel: 'claude.ai', scopes: [] },
        { method: 'server/discover', clientName: null },
      ),
    ).toBe('[sieb] MCP server/discover by alice via oauth (claude.ai), scopes none')
  })
})
