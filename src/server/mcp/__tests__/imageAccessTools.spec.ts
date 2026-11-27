// @vitest-environment node
import type { AuthInfo, CallToolResult } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'

import type { PullProbeResult } from '#core/imageVisibility.ts'
import { NGINX } from '#server/db/__tests__/dbFixtures.ts'
import { listFindingsByVuln } from '#server/db/findingRepository.ts'
import { createMcpServer } from '#server/mcp/createMcpServer.ts'
import { fakePullProber } from '#server/visibility/__tests__/fakePullProber.ts'

import { AUTHENTIK, BASE_URL, KEV_CVE, seededToolDeps } from './mcpFixtures.ts'
import { connectTestClient } from './mcpTestClient.ts'

/**
 * Connects a read-only client over the seeded database with a fake pull prober.
 * @param {PullProbeResult | null} probe - Result the prober stores for own images
 * @returns {Promise<object>} - Client, prober calls and the own finding id
 */
const connect = async (probe: PullProbeResult | null) => {
  const fake = fakePullProber(probe)
  const deps = seededToolDeps({ pullProber: fake.prober })
  const authInfo: AuthInfo = {
    token: 'sieb_test',
    clientId: 'sieb-token-1',
    scopes: ['sieb:read'],
    resource: new URL(`${BASE_URL}/mcp`),
    extra: { actor: 'dev', via: 'token', tokenId: 1, clientLabel: 'laptop' },
  }

  fake.attach(deps.db)

  const client = await connectTestClient(createMcpServer(deps, authInfo, 'test'))
  const ownId = listFindingsByVuln(deps.db, KEV_CVE)[0]?.id ?? 0

  return { client, calls: fake.calls, ownId }
}

/**
 * Returns the structured content of a tool result.
 * @param {CallToolResult} result - Tool result
 * @returns {Record<string, unknown>} - Structured content
 */
const content = (result: CallToolResult): Record<string, unknown> =>
  (result.structuredContent ?? {}) as Record<string, unknown>

describe('image access in MCP tool results', () => {
  it('probes the own image in get_finding and answers its visibility and ownership', async () => {
    const { client, calls, ownId } = await connect('public')
    const result = content(await client.callTool('get_finding', { findingId: ownId }))

    expect(result.finding).toMatchObject({
      imageRef: AUTHENTIK,
      imageVisibility: 'public',
      ownership: 'own',
    })
    expect(calls.map((call) => call.images.map((image) => image.imageRef))).toEqual([[AUTHENTIK]])
    expect(calls[0]?.waitMs).toBeGreaterThan(0)
  })

  it('probes the own images in check_vulnerability, a probe without answer leaves unknown', async () => {
    const { client, calls } = await connect(null)
    const result = content(await client.callTool('check_vulnerability', { vulnId: KEV_CVE }))

    expect(result.affected).toMatchObject([
      { imageRef: AUTHENTIK, imageVisibility: 'unknown', ownership: 'own' },
    ])
    expect(calls).toHaveLength(1)
  })

  it('answers restricted once the probe saw the own image refused', async () => {
    const { client } = await connect('restricted')
    const result = content(await client.callTool('check_vulnerability', { vulnId: KEV_CVE }))

    expect(result.affected).toMatchObject([{ imageVisibility: 'restricted', ownership: 'own' }])
  })

  it('does not probe in search_findings and get_image', async () => {
    const { client, calls } = await connect('public')
    const rows = content(await client.callTool('search_findings', { vulnIds: [KEV_CVE] }))

    await client.callTool('get_image', { imageRef: AUTHENTIK })
    await client.callTool('get_image', { imageRef: NGINX })

    expect(rows.findings).toMatchObject([{ imageVisibility: 'unknown', ownership: 'own' }])
    expect(calls).toEqual([])
  })
})
