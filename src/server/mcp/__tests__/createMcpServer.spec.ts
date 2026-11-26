// @vitest-environment node
import type { AuthInfo } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'

import { createMcpServer } from '#server/mcp/createMcpServer.ts'
import { mcpEndpointUrl } from '#server/mcp/mcpEndpointUrl.ts'

import { seededToolDeps } from './mcpFixtures.ts'
import { connectTestClient } from './mcpTestClient.ts'

/**
 * Builds the AuthInfo a verifier produces for a request, with the resource mcpRoute resolves.
 * @param {string | null} publicUrl - Configured SIEB_PUBLIC_URL
 * @param {Request} request - Incoming MCP request
 * @returns {AuthInfo} - Verified token information
 */
const authInfoFor = (publicUrl: string | null, request: Request): AuthInfo => ({
  token: 'sieb_test',
  clientId: 'laptop',
  scopes: ['sieb:read'],
  expiresAt: Math.floor(Date.now() / 1000) + 60,
  resource: mcpEndpointUrl(publicUrl, request),
  extra: { actor: 'dev', via: 'token', tokenId: 1, clientLabel: 'laptop' },
})

/**
 * Reads the inbox link get_overview answers on a server created for an AuthInfo.
 * @param {AuthInfo} authInfo - Verified token information
 * @returns {Promise<unknown>} - inboxUrl
 */
const inboxLinkOf = async (authInfo: AuthInfo): Promise<unknown> => {
  const client = await connectTestClient(createMcpServer(seededToolDeps(), authInfo, 'test'))
  const result = await client.callTool('get_overview')

  return (result.structuredContent as { inboxUrl?: unknown } | undefined)?.inboxUrl
}

describe('createMcpServer links', () => {
  const request = new Request('http://sieb.internal:3100/mcp', {
    method: 'POST',
    headers: { 'X-Forwarded-Proto': 'https' },
  })

  it('uses SIEB_PUBLIC_URL when configured', async () => {
    expect(await inboxLinkOf(authInfoFor('https://sieb.example.com', request))).toBe(
      'https://sieb.example.com/inbox',
    )
  })

  it('derives an absolute origin from the request and X-Forwarded-Proto without it', async () => {
    expect(await inboxLinkOf(authInfoFor(null, request))).toBe('https://sieb.internal:3100/inbox')
  })

  it('refuses an AuthInfo without resource', () => {
    const { resource: _resource, ...withoutResource } = authInfoFor(null, request)

    expect(() => createMcpServer(seededToolDeps(), withoutResource, 'test')).toThrow('resource')
  })
})
