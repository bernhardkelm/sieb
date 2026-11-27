// @vitest-environment node
import { McpServer } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'

import { buildProposalInput, PROPOSER } from '#core/__tests__/proposalBuilders.ts'
import { NGINX, REDIS } from '#server/db/__tests__/dbFixtures.ts'
import { insertProposal } from '#server/db/proposalRepository.ts'
import { registerQueryTools } from '#server/mcp/tools/registerQueryTools.ts'

import { AUTHENTIK, KEV_CVE, MCP_NOW, seededToolDeps, TEST_CALLER } from './mcpFixtures.ts'
import { connectTestClient } from './mcpTestClient.ts'

interface SearchResult {
  findings: { vulnId: string; imageRef: string }[]
  notes: string[]
}

/**
 * Calls search_findings with a pending filter over the seeded data plus an open proposal on
 * every image of CVE-2025-1000.
 * @param {string[]} pending - Pending options
 * @returns {Promise<SearchResult>} - Structured content
 */
const searchPending = async (pending: string[]): Promise<SearchResult> => {
  const deps = seededToolDeps()
  const server = new McpServer({ name: 'sieb', version: 'test' })

  insertProposal(deps.db, {
    ...buildProposalInput({ scope: 'all', imageRefs: null }),
    ...PROPOSER,
    sourceAccess: [],
    basisDecisions: [],
    createdAt: MCP_NOW.toISOString(),
  })
  registerQueryTools(server, deps, TEST_CALLER)

  const result = await (await connectTestClient(server)).callTool('search_findings', { pending })

  expect(result.isError).toBeFalsy()
  return result.structuredContent as unknown as SearchResult
}

/**
 * Returns the vulnId and image of every row.
 * @param {SearchResult} result - Search result
 * @returns {string[][]} - Pairs, sorted
 */
const pairs = (result: SearchResult): string[][] =>
  result.findings.map((row) => [row.vulnId, row.imageRef]).sort()

describe('search_findings pending', () => {
  it('keeps findings an all-images proposal targets, or the untouched ones', async () => {
    expect(pairs(await searchPending(['proposed']))).toEqual([
      ['CVE-2025-1000', NGINX],
      ['CVE-2025-1000', REDIS],
    ])
    expect(pairs(await searchPending(['untouched']))).toEqual([
      [KEV_CVE, AUTHENTIK],
      ['CVE-2025-2000', NGINX],
    ])
  })

  it('notes that checking is ignored while Auto-check is off', async () => {
    const result = await searchPending(['checking'])

    expect(result.findings).toHaveLength(4)
    expect(result.notes).toEqual(['pending checking was ignored: Auto-check is off'])
  })
})
