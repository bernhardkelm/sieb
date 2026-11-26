// @vitest-environment node
import { McpServer } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'

import { markSeen } from '#server/db/inboxRepository.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'
import { registerQueryTools } from '#server/mcp/tools/registerQueryTools.ts'

import { MCP_NOW, seededToolDeps, TEST_CALLER } from './mcpFixtures.ts'
import { connectTestClient } from './mcpTestClient.ts'

/**
 * Calls get_overview as the test caller and returns its Inbox counts.
 * @param {McpToolDeps} deps - Dependencies
 * @returns {Promise<unknown>} - inboxItems of the result
 */
const inboxItemsOf = async (deps: McpToolDeps): Promise<unknown> => {
  const server = new McpServer({ name: 'sieb', version: 'test' })

  registerQueryTools(server, deps, TEST_CALLER)
  const result = await (await connectTestClient(server)).callTool('get_overview')

  return (result.structuredContent as { inboxItems?: unknown } | undefined)?.inboxItems
}

describe('get_overview Inbox counts', () => {
  it('counts the Inbox of the calling actor, without the marks of other users', async () => {
    const deps = seededToolDeps()
    const zero = { proposal: 0, reopened: 0, expiring: 0, kev: 0, total: 0 }

    expect(await inboxItemsOf(deps)).toEqual(zero)

    deps.db
      .prepare('UPDATE findings SET kev_since = ? WHERE kev = 1')
      .run(new Date(MCP_NOW.getTime() - 60_000).toISOString())
    markSeen(deps.db, 'alice', ['kev:4'], MCP_NOW)

    expect(await inboxItemsOf(deps)).toEqual({ ...zero, kev: 1, total: 1 })

    markSeen(deps.db, TEST_CALLER.actor, ['kev:4'], MCP_NOW)

    expect(await inboxItemsOf(deps)).toEqual(zero)
  })
})
