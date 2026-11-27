// @vitest-environment node
import type { AuthInfo, CallToolResult } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'

import { NGINX, REDIS } from '#server/db/__tests__/dbFixtures.ts'
import { createDecision } from '#server/db/createDecision.ts'
import { listFindingsByVuln } from '#server/db/findingRepository.ts'
import { countOpenProposals, getProposal } from '#server/db/proposalRepository.ts'
import { createMcpServer } from '#server/mcp/createMcpServer.ts'
import type { CheckScope } from '#server/mcp/mcpCaller.ts'
import { PROPOSE_RATE_LIMIT } from '#server/mcp/mcpGuards.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'

import { BASE_URL, MCP_NOW, seededToolDeps } from './mcpFixtures.ts'
import { connectTestClient, type McpTestClient } from './mcpTestClient.ts'

const CVE = 'CVE-2025-1000'
const CHECK_TOKEN = 50

const CLAIMS = {
  verdict: 'not_affected',
  justification: 'vulnerable_code_not_in_execute_path',
  summary: 'The parser is never called.',
  confidence: 'medium',
  evidence: [{ check: 'callers', method: 'grep -r parse src/', result: 'none' }],
  evidenceBasis: ['upstream_source'],
}

/**
 * Seeds the tool database with a running check of CVE-2025-1000 in redis, run with CHECK_TOKEN,
 * and a decision of another CVE.
 * @returns {{ deps: McpToolDeps; scope: CheckScope; otherFinding: number }} - Dependencies, check scope and the nginx finding of the same CVE
 */
const checkSetup = (): { deps: McpToolDeps; scope: CheckScope; otherFinding: number } => {
  const deps = seededToolDeps()
  const findings = listFindingsByVuln(deps.db, CVE)
  const findingId = findings.find((finding) => finding.imageRef === REDIS)?.id ?? 0
  const at = MCP_NOW.toISOString()
  const checkId = Number(
    deps.db
      .prepare(
        `INSERT INTO checks (finding_id, vuln_id, image_ref, requested_by, state, phase,
           created_at, started_at, heartbeat_at, token_id)
         VALUES (?, ?, ?, 'dev', 'running', 'investigating', ?, ?, ?, ?)`,
      )
      .run(findingId, CVE, REDIS, at, at, at, CHECK_TOKEN).lastInsertRowid,
  )

  createDecision(
    deps.db,
    {
      vulnId: 'CVE-2025-2000',
      scope: 'image',
      imageRef: NGINX,
      status: 'accepted',
      justification: null,
      reason: 'Low risk',
      expiresAt: null,
    },
    'alice',
    MCP_NOW,
  )

  return {
    deps,
    scope: { checkId, findingId, vulnId: CVE, imageRef: REDIS },
    otherFinding: findings.find((finding) => finding.imageRef === NGINX)?.id ?? 0,
  }
}

/**
 * Connects a client as dev with read and propose, through the check token or a personal token.
 * @param {McpToolDeps} deps - Seeded dependencies
 * @param {CheckScope | null} scope - Check scope, null for dev's personal token 1
 * @returns {Promise<McpTestClient>} - Connected client
 */
const connectAs = (deps: McpToolDeps, scope: CheckScope | null): Promise<McpTestClient> => {
  const authInfo: AuthInfo = {
    token: 'sieb_test',
    clientId: `sieb-token-${scope === null ? 1 : CHECK_TOKEN}`,
    scopes: ['sieb:read', 'sieb:propose'],
    resource: new URL(`${BASE_URL}/mcp`),
    extra: {
      actor: 'dev',
      via: 'token',
      tokenId: scope === null ? 1 : CHECK_TOKEN,
      clientLabel: scope === null ? 'laptop' : `Auto-check #${scope.checkId}`,
      check: scope,
    },
  }

  return connectTestClient(createMcpServer(deps, authInfo, 'test'))
}

/**
 * Returns whether a tool result is the refusal of a call outside the check.
 * @param {CallToolResult} result - Tool result
 * @returns {boolean} - True for the outside-check error
 */
const outside = (result: CallToolResult): boolean => {
  const [block] = result.content

  return (
    result.isError === true &&
    block?.type === 'text' &&
    block.text.includes('this Auto-check token only reaches')
  )
}

/**
 * Returns the structured content of a tool result.
 * @param {CallToolResult} result - Tool result
 * @returns {Record<string, unknown>} - Structured content
 */
const content = (result: CallToolResult): Record<string, unknown> =>
  (result.structuredContent ?? {}) as Record<string, unknown>

describe('tools of a check token', () => {
  it('lists neither search_findings nor get_overview', async () => {
    const { deps, scope } = checkSetup()
    const names = (await (await connectAs(deps, scope)).listTools()).map((tool) => tool.name)

    expect(names.sort()).toEqual([
      'check_vulnerability',
      'get_finding',
      'get_image',
      'list_decisions',
      'list_my_proposals',
      'propose_decision',
    ])
  })

  it('reads only its own finding', async () => {
    const { deps, scope, otherFinding } = checkSetup()
    const client = await connectAs(deps, scope)

    expect((await client.callTool('get_finding', { findingId: scope.findingId })).isError).not.toBe(
      true,
    )
    expect(
      (await client.callTool('get_finding', { vulnId: 'cve-2025-1000', imageRef: `${REDIS}:7` }))
        .isError,
    ).not.toBe(true)
    expect(outside(await client.callTool('get_finding', { findingId: otherFinding }))).toBe(true)
    expect(outside(await client.callTool('get_finding', { findingId: 9999 }))).toBe(true)
    expect(outside(await client.callTool('get_finding', { vulnId: CVE, imageRef: NGINX }))).toBe(
      true,
    )
  })

  it('checks only its own CVE and reads only its own image', async () => {
    const { deps, scope } = checkSetup()
    const client = await connectAs(deps, scope)

    expect(
      (await client.callTool('check_vulnerability', { vulnId: 'cve-2025-1000' })).isError,
    ).not.toBe(true)
    expect(outside(await client.callTool('check_vulnerability', { vulnId: 'CVE-2025-2000' }))).toBe(
      true,
    )
    expect((await client.callTool('get_image', { imageRef: `${REDIS}:7` })).isError).not.toBe(true)
    expect(outside(await client.callTool('get_image', { imageRef: NGINX }))).toBe(true)
  })

  it('lists only the decisions of its own CVE', async () => {
    const { deps, scope } = checkSetup()
    const client = await connectAs(deps, scope)
    const all = content(await client.callTool('list_decisions', {}))
    const decisions = all.decisions as { vulnId: string }[]

    expect(decisions.length).toBeGreaterThan(0)
    expect(decisions.every((decision) => decision.vulnId === CVE)).toBe(true)
    expect(outside(await client.callTool('list_decisions', { vulnId: 'CVE-2025-2000' }))).toBe(true)
    expect(outside(await client.callTool('list_decisions', { vulnId: 'CVE-2025-*' }))).toBe(true)
  })
})

describe('propose_decision with a check token', () => {
  it('files only for its own finding, never for all images', async () => {
    const { deps, scope, otherFinding } = checkSetup()
    const client = await connectAs(deps, scope)
    const own = await client.callTool('propose_decision', { findingId: scope.findingId, ...CLAIMS })
    const again = await client.callTool('propose_decision', {
      vulnId: CVE,
      imageRefs: [`${REDIS}:7.4`],
      ...CLAIMS,
    })

    expect(own.isError).not.toBe(true)
    expect(content(again).replacedProposalId).toBe(content(own).proposalId)

    for (const target of [
      { findingId: otherFinding },
      { vulnId: CVE, all: true },
      { vulnId: CVE, imageRefs: [REDIS, NGINX] },
      { vulnId: 'CVE-2025-2000', imageRefs: [REDIS] },
    ]) {
      expect(outside(await client.callTool('propose_decision', { ...target, ...CLAIMS }))).toBe(
        true,
      )
    }
  })

  it('never supersedes the requester own proposal, nor the other way round', async () => {
    const { deps, scope } = checkSetup()
    const user = await connectAs(deps, null)
    const check = await connectAs(deps, scope)
    const target = { vulnId: CVE, imageRefs: [REDIS], ...CLAIMS }
    const mine = content(await user.callTool('propose_decision', target))
    const checks = content(await check.callTool('propose_decision', target))
    const mineAgain = content(await user.callTool('propose_decision', target))

    expect(checks.replacedProposalId).toBeUndefined()
    expect(mineAgain.replacedProposalId).toBe(mine.proposalId)
    expect(getProposal(deps.db, Number(checks.proposalId))?.state).toBe('open')
    expect(countOpenProposals(deps.db, 'dev')).toBe(1)
  })

  it('uses its own rate bucket, not the requester quota', async () => {
    const { deps, scope } = checkSetup()

    for (let call = 0; call < PROPOSE_RATE_LIMIT; call += 1) {
      deps.proposalLimiter.hit('propose:dev', MCP_NOW.getTime())
    }

    const user = await connectAs(deps, null)
    const check = await connectAs(deps, scope)
    const refused = await user.callTool('propose_decision', {
      findingId: scope.findingId,
      ...CLAIMS,
    })

    expect(refused.isError).toBe(true)
    expect(
      (await check.callTool('propose_decision', { findingId: scope.findingId, ...CLAIMS })).isError,
    ).not.toBe(true)
  })

  it('lists only what the check filed', async () => {
    const { deps, scope } = checkSetup()
    const user = await connectAs(deps, null)
    const check = await connectAs(deps, scope)

    await user.callTool('propose_decision', { findingId: scope.findingId, ...CLAIMS })
    const filed = content(
      await check.callTool('propose_decision', { findingId: scope.findingId, ...CLAIMS }),
    )
    const listed = content(await check.callTool('list_my_proposals', {}))

    expect(listed.total).toBe(1)
    expect((listed.proposals as { proposalId: number }[])[0]?.proposalId).toBe(filed.proposalId)
    expect(content(await user.callTool('list_my_proposals', {})).total).toBe(2)
  })
})
