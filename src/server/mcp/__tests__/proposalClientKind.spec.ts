// @vitest-environment node
import type { AuthInfo } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'

import type { ApiTokenCreateResponse } from '#core/tokenApiTypes.ts'
import type { FindingView } from '#core/findingView.ts'
import { REDIS } from '#server/db/__tests__/dbFixtures.ts'
import { listFindingsByVuln } from '#server/db/findingRepository.ts'
import { getProposal } from '#server/db/proposalRepository.ts'
import { requestJson, syncedTestApp } from '#server/http/__tests__/appFixtures.ts'
import { createMcpServer } from '#server/mcp/createMcpServer.ts'
import { withClient } from '#server/mcp/mcpClient.ts'

import { BASE_URL, seededToolDeps } from './mcpFixtures.ts'
import { connectTestClient } from './mcpTestClient.ts'

const CLAIMS = {
  verdict: 'not_affected',
  justification: 'vulnerable_code_not_in_execute_path',
  summary: 'The parser is never called.',
  confidence: 'medium',
  evidence: [{ check: 'callers', method: 'grep -r parse src/', result: 'none' }],
  evidenceBasis: ['upstream_source'],
}
const ALICE = { 'X-authentik-username': 'alice' }
const CLOUD_AGENT = 'connector-cloud/1.0'

/**
 * Builds a JSON-RPC initialize message with a clientInfo name.
 * @param {string} name - clientInfo name
 * @returns {Record<string, unknown>} - Message
 */
const initialize = (name: string): Record<string, unknown> => ({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name, version: '1' } },
})

describe('client kind of a proposal', () => {
  it('stores the kind the User-Agent of the tool call names', async () => {
    const deps = seededToolDeps()
    const base: AuthInfo = {
      token: 'sieb_test',
      clientId: 'sieb-token-1',
      scopes: ['sieb:read', 'sieb:propose'],
      resource: new URL(`${BASE_URL}/mcp`),
      extra: { actor: 'dev', via: 'token', tokenId: 1, clientLabel: 'laptop' },
    }
    const authInfo = withClient(base, {
      clientName: null,
      userAgent: 'claude-code/2.1.332 (claude-vscode)',
    })
    const client = await connectTestClient(createMcpServer(deps, authInfo, 'test'))
    const redis = listFindingsByVuln(deps.db, 'CVE-2025-1000').find((f) => f.imageRef === REDIS)
    const result = await client.callTool('propose_decision', { findingId: redis?.id, ...CLAIMS })
    const { proposalId } = result.structuredContent as { proposalId: number }

    expect(getProposal(deps.db, proposalId)).toMatchObject({
      clientLabel: 'laptop',
      clientKind: 'claude_code_vscode',
    })
  })

  it('ties a tool call to the handshake of the same caller and User-Agent over /mcp', async () => {
    const { app, deps } = await syncedTestApp({
      devUser: null,
      mcpEnabled: true,
      clock: () => new Date(),
    })
    const created = await requestJson<ApiTokenCreateResponse>(
      app,
      '/api/tokens',
      'POST',
      {
        name: 'phone',
        scope: 'propose',
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
      ALICE,
    )
    const findings = (
      await requestJson<FindingView[]>(app, '/api/findings?view=inbox', 'GET', undefined, ALICE)
    ).body
    /**
     * Posts one JSON-RPC message to /mcp with a User-Agent.
     * @param {unknown} message - JSON-RPC message
     * @param {string} userAgent - User-Agent header
     * @returns {Promise<{ result?: { structuredContent?: { proposalId: number } } }>} - JSON-RPC answer
     */
    const post = async (
      message: unknown,
      userAgent: string,
    ): Promise<{ result?: { structuredContent?: { proposalId: number } } }> =>
      (
        await app.request('/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            Authorization: `Bearer ${created.body.secret}`,
            'User-Agent': userAgent,
          },
          body: JSON.stringify(message),
        })
      ).json() as Promise<{ result?: { structuredContent?: { proposalId: number } } }>
    /**
     * Proposes for one finding of the inbox and reads back the stored kind.
     * @param {number} index - Inbox position of the finding
     * @param {string} userAgent - User-Agent header
     * @returns {Promise<string | null | undefined>} - Stored client kind
     */
    const proposeKind = async (
      index: number,
      userAgent: string,
    ): Promise<string | null | undefined> => {
      const answer = await post(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'propose_decision',
            arguments: { findingId: findings[index]?.id, ...CLAIMS },
          },
        },
        userAgent,
      )

      return getProposal(deps.db, answer.result?.structuredContent?.proposalId ?? 0)?.clientKind
    }

    await post(initialize('Anthropic/ClaudeAI'), CLOUD_AGENT)

    expect(await proposeKind(0, CLOUD_AGENT)).toBe('claude_app')
    expect(await proposeKind(1, 'other-client/2.0')).toBeNull()
    expect(await proposeKind(2, 'claude-code/2.1.332 (claude-desktop)')).toBe('claude_code_app')
    expect(await proposeKind(3, `claude-code/2.1.332 (cli)${'x'.repeat(5000)}`)).toBe(
      'claude_code_cli',
    )
  })
})
