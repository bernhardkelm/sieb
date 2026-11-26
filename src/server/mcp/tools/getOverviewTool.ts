import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { inboxUrl, linkBase } from '#core/siebLinks.ts'
import { readKevFeedStatus } from '#server/db/kevFeedRepository.ts'
import { readInbox } from '#server/db/readInbox.ts'
import { readOverviewStats } from '#server/db/readOverviewStats.ts'
import { canPropose, MCP_SCOPES, type McpCaller } from '#server/mcp/mcpCaller.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'
import { READ_ONLY_TOOL, toolResult } from '#server/mcp/toolResult.ts'
import { kevSourceSchema } from '#server/mcp/views/advisoryFacts.ts'
import { lastSyncSchema, readLastSync } from '#server/mcp/views/lastSync.ts'

const count = z.number().int()

const outputSchema = z.object({
  stats: z
    .object({
      open: count.describe('open findings, CVE x image'),
      inbox: count.describe('open findings without an active or fix_planned decision'),
      kev: count,
      public: count.describe('open findings in publicly exposed workloads'),
      bySeverity: z.object({
        critical: count,
        high: count,
        medium: count,
        low: count,
        unknown: count,
      }),
      notAffected: count.describe('governed by an active not_affected decision, alerts muted'),
      accepted: count.describe('governed by an active accepted decision, alerts muted'),
      fixPlanned: count.describe('decisions in state fix_planned'),
      reopened: count.describe('decisions re-opened by a severity rise or KEV listing'),
      activeDecisions: count,
      images: count.describe('images with an open finding'),
    })
    .describe('live counts'),
  lastSync: lastSyncSchema,
  kevSource: kevSourceSchema,
  kevCatalog: z
    .object({ lastSuccessAt: z.string().nullable(), entryCount: count, stale: z.boolean() })
    .nullable()
    .describe('health of the CISA catalog, null for other KEV sources'),
  connectedAs: z.object({
    actor: z.string(),
    via: z.enum(['token', 'oauth']),
    client: z.string(),
    scopes: z.array(z.enum(MCP_SCOPES)).describe('sieb scopes the token of this connection holds'),
    canPropose: z
      .boolean()
      .describe('whether this connection may call propose_decision, needs sieb:propose'),
  }),
  inboxItems: z
    .object({
      proposal: count.describe('open proposals awaiting review'),
      reopened: count.describe('re-opened decisions'),
      expiring: count.describe('active decisions expiring within 14 days, not marked seen'),
      kev: count.describe('open findings KEV listed within the last 14 days, not marked seen'),
      total: count,
    })
    .describe('what waits in the Inbox of the connected user'),
  inboxUrl: z.string(),
})

/**
 * Registers get_overview: the counts behind "how are we doing".
 * @param {McpServer} server - MCP server
 * @param {McpToolDeps} deps - Database, clock, KEV source and link base
 * @param {McpCaller} caller - Authenticated caller, reported back
 * @returns {void}
 */
export const registerGetOverviewTool = (
  server: McpServer,
  deps: McpToolDeps,
  caller: McpCaller,
): void => {
  server.registerTool(
    'get_overview',
    {
      title: 'Overview',
      description:
        'Reads the live overview counts (open, inbox, KEV, public, by severity, not affected, accepted, fix planned, re-opened), the Inbox item counts of the connected user (proposals, re-opened, expiring, new KEV), the time of the last successful sync, the KEV source, and who is connected with which scopes and whether propose_decision is available.',
      outputSchema,
      annotations: READ_ONLY_TOOL,
    },
    () => {
      const now = deps.clock()
      const feed = deps.kevSource === 'cisa' ? readKevFeedStatus(deps.db, now) : null

      return toolResult({
        stats: readOverviewStats(deps.db, now),
        lastSync: readLastSync(deps.db),
        kevSource: deps.kevSource,
        kevCatalog: feed
          ? { lastSuccessAt: feed.lastSuccessAt, entryCount: feed.entryCount, stale: feed.stale }
          : null,
        connectedAs: {
          actor: caller.actor,
          via: caller.via,
          client: caller.clientLabel,
          scopes: caller.scopes,
          canPropose: canPropose(caller),
        },
        inboxItems: readInbox(deps.db, caller.actor, now, deps.baseUrl).counts,
        inboxUrl: inboxUrl(linkBase(deps.baseUrl)),
      })
    },
  )
}
