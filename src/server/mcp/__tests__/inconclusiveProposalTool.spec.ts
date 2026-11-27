// @vitest-environment node
import type { AuthInfo, CallToolResult } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'

import { REDIS } from '#server/db/__tests__/dbFixtures.ts'
import { listFindingsByVuln } from '#server/db/findingRepository.ts'
import { getProposal } from '#server/db/proposalRepository.ts'
import { createMcpServer } from '#server/mcp/createMcpServer.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'

import { BASE_URL, seededToolDeps } from './mcpFixtures.ts'
import { connectTestClient, type McpTestClient } from './mcpTestClient.ts'

const INCONCLUSIVE = {
  verdict: 'inconclusive',
  summary: 'The advisory names no affected function, the image could not be pulled.',
  confidence: 'low',
  evidence: [{ check: 'advisory text', method: 'get_finding', result: 'no function named' }],
  evidenceBasis: ['advisory'],
  missing: ['pull access to registry.example.com/app', 'runtime check of the loaded modules'],
}

/**
 * Connects a propose client to a server over the seeded database.
 * @param {McpToolDeps} deps - Dependencies
 * @returns {Promise<McpTestClient>} - Connected client
 */
const connect = (deps: McpToolDeps): Promise<McpTestClient> => {
  const authInfo: AuthInfo = {
    token: 'sieb_test',
    clientId: 'sieb-token-1',
    scopes: ['sieb:read', 'sieb:propose'],
    resource: new URL(`${BASE_URL}/mcp`),
    extra: { actor: 'dev', via: 'token', tokenId: 1, clientLabel: 'laptop' },
  }

  return connectTestClient(createMcpServer(deps, authInfo, 'test'))
}

/**
 * Returns the text of an error result.
 * @param {CallToolResult} result - Tool result
 * @returns {string} - Text of the first block, empty for a successful result
 */
const errorText = (result: CallToolResult): string => {
  const [block] = result.content

  return result.isError === true && block?.type === 'text' ? block.text : ''
}

describe('propose_decision with verdict inconclusive', () => {
  it('describes the verdict and the missing field in its input schema', async () => {
    const client = await connect(seededToolDeps())
    const tool = (await client.listTools()).find(
      (candidate) => candidate.name === 'propose_decision',
    )
    const properties = (tool?.inputSchema.properties ?? {}) as Record<
      string,
      { description?: string; enum?: string[] }
    >

    expect(properties.verdict?.enum).toContain('inconclusive')
    expect(properties.verdict?.description).toContain(
      'inconclusive: the evidence supports no verdict',
    )
    expect(properties.verdict?.description).toContain(
      'fix_planned with fix.availability upstream_pending, not needs_patch',
    )
    expect(properties.verdict?.description).toContain(
      'KEV listed: prefer needs_patch or fix_planned over accepted',
    )
    expect(properties.confidence?.description).toContain(
      'medium at most for an own image you could not inspect',
    )
    expect(properties.references?.description).toContain(
      'never a search result or a page that came back empty',
    )
    expect(tool?.description).toContain(
      'File one at the end of every triage without asking, inconclusive included; call' +
        ' list_my_proposals first and do not repeat a rejected proposal without new evidence.',
    )
    expect(properties.missing?.description).toContain('required with inconclusive only')
    expect(tool?.inputSchema.required).not.toContain('missing')
  })

  it('files it without a patch action, stores what is missing and replaces the open one', async () => {
    const deps = seededToolDeps()
    const client = await connect(deps)
    const redis = listFindingsByVuln(deps.db, 'CVE-2025-1000').find((f) => f.imageRef === REDIS)
    const first = await client.callTool('propose_decision', {
      findingId: redis?.id,
      ...INCONCLUSIVE,
    })
    const second = await client.callTool('propose_decision', {
      findingId: redis?.id,
      ...INCONCLUSIVE,
      missing: ['advisory text not reachable'],
    })

    expect(first.isError).not.toBe(true)
    expect(second.structuredContent).toMatchObject({ proposalId: 2, replacedProposalId: 1 })
    expect(getProposal(deps.db, 2)).toMatchObject({
      verdict: 'inconclusive',
      confidence: 'low',
      justification: null,
      missing: ['advisory text not reachable'],
      state: 'open',
      decisionIds: [],
    })
    expect(getProposal(deps.db, 1)).toMatchObject({ state: 'superseded', resolution: 'replaced' })
  })

  it('tells the model when missing is absent or does not belong to the verdict', async () => {
    const deps = seededToolDeps()
    const client = await connect(deps)
    const redis = listFindingsByVuln(deps.db, 'CVE-2025-1000').find((f) => f.imageRef === REDIS)
    const target = { findingId: redis?.id }
    const without = await client.callTool('propose_decision', {
      ...target,
      ...INCONCLUSIVE,
      missing: undefined,
    })
    const onVerdict = await client.callTool('propose_decision', {
      ...target,
      ...INCONCLUSIVE,
      verdict: 'accepted',
    })
    const unconfident = await client.callTool('propose_decision', {
      ...target,
      ...INCONCLUSIVE,
      confidence: undefined,
    })

    expect(errorText(without)).toContain(
      'missing: required with inconclusive, what would be needed to decide',
    )
    expect(errorText(onVerdict)).toContain('missing: only with inconclusive')
    expect(unconfident.isError).toBe(true)
    expect(getProposal(deps.db, 1)).toBeNull()
  })
})
