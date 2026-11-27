// @vitest-environment node
import type { AuthInfo, CallToolResult } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'

import { validateAcceptEdits } from '#core/proposalAcceptEdits.ts'
import { acceptProposal } from '#server/db/acceptProposal.ts'
import { getProposal } from '#server/db/proposalRepository.ts'
import { createMcpServer } from '#server/mcp/createMcpServer.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'

import { AUTHENTIK, BASE_URL, KEV_CVE, seededToolDeps } from './mcpFixtures.ts'
import { connectTestClient, matchesAdvertisedSchema, type McpTestClient } from './mcpTestClient.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Output = Record<string, any> // tool output read loosely in assertions

const WAITING_FOR = 'k3s release bundling traefik 3.7.17 or later'

const UPSTREAM = {
  vulnId: KEV_CVE,
  imageRefs: [AUTHENTIK],
  verdict: 'fix_planned',
  summary: 'Reachable, no fixed k3s release yet.',
  confidence: 'medium',
  evidence: [{ check: 'k3s releases', method: 'release page', result: 'no fix yet' }],
  evidenceBasis: ['advisory'],
  fix: {
    action: 'k3s: wait for a release bundling traefik 3.7.17',
    layer: 'platform',
    availability: 'upstream_pending',
    waitingFor: WAITING_FOR,
    interim: {
      action: 'override the bundled traefik image via HelmChartConfig',
      caveats: 'conflicts with k3s upgrades, revert once k3s ships traefik 3.7.17',
    },
  },
  review: { date: '2026-07-01', why: 'next k3s release' },
}

/**
 * Connects a propose client to a server over the given dependencies.
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
 * @returns {string} - Text of the first block
 */
const errorText = (result: CallToolResult): string => {
  const [block] = result.content

  return result.isError === true && block?.type === 'text' ? block.text : ''
}

/**
 * Calls a read tool and checks the result against its advertised output schema.
 * @param {McpTestClient} client - Connected client
 * @param {string} name - Tool name
 * @param {Record<string, unknown>} args - Arguments
 * @returns {Promise<Output>} - Structured content
 */
const call = async (
  client: McpTestClient,
  name: string,
  args: Record<string, unknown>,
): Promise<Output> => {
  const tool = (await client.listTools()).find((candidate) => candidate.name === name)
  const result = await client.callTool(name, args)

  expect(result.isError).toBeFalsy()
  expect(tool && (await matchesAdvertisedSchema(tool, result.structuredContent))).toBe(true)

  return result.structuredContent ?? {}
}

describe('propose_decision with an upstream_pending fix', () => {
  it('describes availability, waitingFor and interim in the input schema', async () => {
    const client = await connect(seededToolDeps())
    const tool = (await client.listTools()).find((item) => item.name === 'propose_decision')
    const fix = tool?.inputSchema.properties?.fix as Output

    expect(fix.properties.availability.enum).toEqual(['available', 'upstream_pending'])
    expect(fix.properties.availability.description).toContain('not from a guess')
    expect(fix.properties.waitingFor.description).toContain('exactly which release or image')
    expect(fix.properties.interim.description).toContain('only when urgent (KEV listed')
  })

  it('names what is missing so Claude can fix it', async () => {
    const client = await connect(seededToolDeps())
    const { availability: _availability, ...withoutAvailability } = UPSTREAM.fix

    expect(
      errorText(
        await client.callTool('propose_decision', { ...UPSTREAM, fix: withoutAvailability }),
      ),
    ).toContain('fix.availability: required with fix_planned')
    expect(
      errorText(
        await client.callTool('propose_decision', {
          ...UPSTREAM,
          fix: { ...UPSTREAM.fix, waitingFor: undefined },
          review: undefined,
        }),
      ),
    ).toMatch(/fix\.waitingFor: required with upstream_pending.*review\.date: required with/u)
    expect(
      errorText(
        await client.callTool('propose_decision', {
          ...UPSTREAM,
          verdict: 'needs_patch',
          fix: { ...UPSTREAM.fix, waitingFor: undefined, interim: undefined },
        }),
      ),
    ).toContain('fix.availability: needs_patch means a published fix')
  })

  it('stores the proposal, and the accepted decision shows in the read tools', async () => {
    const deps = seededToolDeps()
    const client = await connect(deps)
    const filed = await client.callTool('propose_decision', UPSTREAM)

    expect(filed.isError).toBeUndefined()

    const proposal = getProposal(deps.db, 1)

    expect(proposal?.fix).toMatchObject({
      availability: 'upstream_pending',
      waitingFor: WAITING_FOR,
      interim: { action: UPSTREAM.fix.interim.action, steps: null },
    })

    const plan = proposal ? validateAcceptEdits(proposal, undefined, deps.clock()) : null

    if (!plan?.ok) {
      throw new Error('plan refused')
    }

    acceptProposal(deps.db, 1, {
      expectedDecisionIds: [{ imageRef: AUTHENTIK, decisionId: null, updatedAt: null }],
      plan: plan.value,
      actor: 'alice',
      now: deps.clock(),
    })

    const finding = await call(client, 'get_finding', { vulnId: KEV_CVE, imageRef: AUTHENTIK })
    const waiting = await call(client, 'list_decisions', { state: 'upstream_pending' })
    const found = await call(client, 'search_findings', { upstreamPending: true })
    const others = await call(client, 'search_findings', { upstreamPending: false })

    expect(finding.decisions[0]).toMatchObject({
      status: 'fix_planned',
      upstreamPending: true,
      untrusted: { waitingFor: WAITING_FOR },
    })
    expect(waiting.decisions.map((item: Output) => item.vulnId)).toEqual([KEV_CVE])
    expect(found.findings.map((item: Output) => item.vulnId)).toEqual([KEV_CVE])
    expect(others.findings.map((item: Output) => item.vulnId)).not.toContain(KEV_CVE)
  })
})
