// @vitest-environment node
import type { AuthInfo, CallToolResult } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'

import type { DatabaseSync } from 'node:sqlite'

import { getProposal } from '#server/db/proposalRepository.ts'
import { COREDNS, relatedDatabase, TARGET_CVE } from '#server/db/__tests__/relatedFixtures.ts'
import { createMcpServer } from '#server/mcp/createMcpServer.ts'
import type { CheckScope } from '#server/mcp/mcpCaller.ts'

import { BASE_URL, MCP_NOW, seededToolDeps } from './mcpFixtures.ts'
import { connectTestClient, type McpTestClient } from './mcpTestClient.ts'

const CHECK_TOKEN = 50

const CLAIMS = {
  verdict: 'not_affected',
  justification: 'component_not_present',
  summary: 'Trivy sorts the pseudo-version below every release.',
  confidence: 'high',
  evidence: [{ check: 'module version', method: 'go version -m', result: 'v1.11.3 commit' }],
  evidenceBasis: ['image'],
}

/**
 * Inserts a running check of the target finding, run with CHECK_TOKEN.
 * @param {DatabaseSync} db - Seeded database
 * @param {number} findingId - Target finding
 * @returns {CheckScope} - Scope of the check token
 */
const runningCheck = (db: DatabaseSync, findingId: number): CheckScope => {
  const at = MCP_NOW.toISOString()
  const checkId = Number(
    db
      .prepare(
        `INSERT INTO checks (finding_id, vuln_id, image_ref, requested_by, state, phase,
           created_at, started_at, heartbeat_at, token_id)
         VALUES (?, ?, ?, 'dev', 'running', 'investigating', ?, ?, ?, ?)`,
      )
      .run(findingId, TARGET_CVE, COREDNS, at, at, at, CHECK_TOKEN).lastInsertRowid,
  )

  return { checkId, findingId, vulnId: TARGET_CVE, imageRef: COREDNS }
}

/**
 * Connects as dev with read and propose, through the check token or personal token 1.
 * @param {DatabaseSync} db - Seeded database
 * @param {CheckScope | null} scope - Check scope, null for the personal token
 * @returns {Promise<McpTestClient>} - Connected client
 */
const connectAs = (db: DatabaseSync, scope: CheckScope | null): Promise<McpTestClient> => {
  const tokenId = scope === null ? 1 : CHECK_TOKEN
  const authInfo: AuthInfo = {
    token: 'sieb_test',
    clientId: `sieb-token-${tokenId}`,
    scopes: ['sieb:read', 'sieb:propose'],
    resource: new URL(`${BASE_URL}/mcp`),
    extra: {
      actor: 'dev',
      via: 'token',
      tokenId,
      clientLabel: scope === null ? 'laptop' : `Auto-check #${scope.checkId}`,
      check: scope,
    },
  }

  return connectTestClient(createMcpServer(seededToolDeps({ db }), authInfo, 'test'))
}

/**
 * Returns the text of the first content block.
 * @param {CallToolResult} result - Tool result
 * @returns {string} - Text, empty without a text block
 */
const textOf = (result: CallToolResult): string => {
  const [block] = result.content

  return block?.type === 'text' ? block.text : ''
}

describe('propose_decision with relatedFindings', () => {
  it('stores the related findings an Auto-check lists on its own image', async () => {
    const { db, target, sibling, otherSibling } = relatedDatabase(MCP_NOW)
    const client = await connectAs(db, runningCheck(db, target))
    const result = await client.callTool('propose_decision', {
      findingId: target,
      ...CLAIMS,
      relatedFindings: [
        { findingId: sibling, note: 'same module, same pseudo-version' },
        { findingId: otherSibling },
      ],
      relatedReason: 'The coredns module is recorded as a pseudo-version.',
    })
    const id = Number((result.structuredContent as { proposalId: number }).proposalId)

    expect(result.isError).not.toBe(true)
    expect(getProposal(db, id)).toMatchObject({
      relatedFindings: [
        { findingId: sibling, note: 'same module, same pseudo-version' },
        { findingId: otherSibling, note: null },
      ],
      relatedReason: 'The coredns module is recorded as a pseudo-version.',
    })

    const listed = await client.callTool('list_my_proposals', {})

    expect(listed.structuredContent).toMatchObject({
      proposals: [{ proposalId: id, relatedFindings: 2 }],
    })
  })

  it('refuses findings beyond an Auto-check image, the target and closed ones with hints', async () => {
    const { db, target, elsewhere, resolved } = relatedDatabase(MCP_NOW)
    const client = await connectAs(db, runningCheck(db, target))
    const result = await client.callTool('propose_decision', {
      findingId: target,
      ...CLAIMS,
      relatedFindings: [{ findingId: elsewhere }, { findingId: target }, { findingId: resolved }],
    })

    expect(result.isError).toBe(true)
    expect(textOf(result)).toBe(
      'invalid proposal, fix and retry:' +
        ' relatedFindings.0.findingId: an Auto-check lists only findings on its own image, from get_image;' +
        ' relatedFindings.1.findingId: the target itself, list only other findings;' +
        ' relatedFindings.2.findingId: no open finding with this id, take ids from get_image',
    )
    expect(db.prepare('SELECT COUNT(*) AS n FROM decision_proposals').get()?.n).toBe(0)
  })

  it('lets a personal token list open findings on any image and hints at duplicates', async () => {
    const { db, target, sibling, elsewhere } = relatedDatabase(MCP_NOW)
    const client = await connectAs(db, null)
    const duplicate = await client.callTool('propose_decision', {
      findingId: target,
      ...CLAIMS,
      relatedFindings: [{ findingId: sibling }, { findingId: sibling }],
    })
    const reasonOnly = await client.callTool('propose_decision', {
      findingId: target,
      ...CLAIMS,
      relatedReason: 'Same cause.',
    })
    const filed = await client.callTool('propose_decision', {
      findingId: target,
      ...CLAIMS,
      relatedFindings: [{ findingId: sibling }, { findingId: elsewhere }],
    })

    expect(textOf(duplicate)).toBe(
      'invalid proposal, fix and retry: relatedFindings.1.findingId: list each finding once',
    )
    expect(textOf(reasonOnly)).toBe(
      'invalid proposal, fix and retry: relatedReason: only with relatedFindings',
    )
    expect(filed.isError).not.toBe(true)
  })
})
