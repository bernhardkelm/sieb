import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { DECISION_JUSTIFICATIONS, DECISION_SCOPES } from '#core/decision.ts'
import { proposalReviewUrl } from '#core/inbox/inboxLinks.ts'
import {
  PROPOSAL_CONFIDENCES,
  PROPOSAL_RESOLUTIONS,
  PROPOSAL_STATES,
  PROPOSAL_VERDICTS,
} from '#core/proposal.ts'
import { linkBase } from '#core/siebLinks.ts'
import { listProposalItems } from '#server/db/proposalViews.ts'
import type { McpCaller } from '#server/mcp/mcpCaller.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'
import { READ_ONLY_TOOL, toolResult } from '#server/mcp/toolResult.ts'

const LIMIT_MAX = 50

const proposalRowSchema = z.object({
  proposalId: z.number().int(),
  vulnId: z.string(),
  scope: z.enum(DECISION_SCOPES),
  imageRefs: z.array(z.string()).nullable().describe('null for scope all'),
  verdict: z.enum(PROPOSAL_VERDICTS),
  justification: z.enum(DECISION_JUSTIFICATIONS).nullable(),
  confidence: z.enum(PROPOSAL_CONFIDENCES),
  state: z.enum(PROPOSAL_STATES),
  resolution: z.enum(PROPOSAL_RESOLUTIONS).nullable(),
  outdated: z.boolean().describe('open and a human changed a decision on the target since'),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  resolvedBy: z.string().nullable(),
  decisionIds: z.array(z.number().int()).describe('decisions written by the accept'),
  relatedFindings: z
    .number()
    .int()
    .describe('other findings you listed as sharing the cause, the human decides them apart'),
  url: z.string(),
  untrusted: z.object({
    summary: z.string(),
    rejectReason: z.string().nullable().describe('free text written by the reviewer'),
  }),
})

const outputSchema = z.object({
  total: z.number().int(),
  proposals: z.array(proposalRowSchema).describe('newest first'),
})

const inputSchema = z.object({
  state: z.enum([...PROPOSAL_STATES, 'all']).default('all'),
  vulnId: z.string().trim().min(1).max(256).optional(),
  limit: z.number().int().min(1).max(LIMIT_MAX).default(20),
  offset: z.number().int().min(0).default(0),
})

/**
 * Registers list_my_proposals: the proposals filed for the caller's sieb user, with their
 * outcome and reject reasons, so a rejected proposal is not filed again. A check caller only
 * sees the proposals of its own token.
 * @param {McpServer} server - MCP server
 * @param {McpToolDeps} deps - Database and link base
 * @param {McpCaller} caller - Authenticated caller
 * @returns {void}
 */
export const registerListMyProposalsTool = (
  server: McpServer,
  deps: McpToolDeps,
  caller: McpCaller,
): void => {
  server.registerTool(
    'list_my_proposals',
    {
      title: 'List my proposals',
      description:
        'Lists the decision proposals filed for your sieb user, newest first, with state (open, accepted, rejected, superseded), resolution, reject reason and review URL. Check it before proposing again.',
      inputSchema,
      outputSchema,
      annotations: READ_ONLY_TOOL,
    },
    (input) => {
      const base = linkBase(deps.baseUrl)
      const wanted = input.vulnId?.toLowerCase()
      const items = listProposalItems(deps.db, {
        proposedBy: caller.actor,
        ...(caller.check === null ? {} : { checkId: caller.check.checkId }),
        ...(input.state === 'all' ? {} : { state: input.state }),
      }).filter((item) => wanted === undefined || item.proposal.vulnId.toLowerCase() === wanted)

      return toolResult({
        total: items.length,
        proposals: items
          .slice(input.offset, input.offset + input.limit)
          .map(({ proposal, outdated }) => ({
            proposalId: proposal.id,
            vulnId: proposal.vulnId,
            scope: proposal.scope,
            imageRefs: proposal.imageRefs,
            verdict: proposal.verdict,
            justification: proposal.justification,
            confidence: proposal.confidence,
            state: proposal.state,
            resolution: proposal.resolution,
            outdated,
            createdAt: proposal.createdAt,
            resolvedAt: proposal.resolvedAt,
            resolvedBy: proposal.resolvedBy,
            decisionIds: proposal.decisionIds,
            relatedFindings: proposal.relatedFindings.length,
            url: proposalReviewUrl(base, proposal.id),
            untrusted: { summary: proposal.summary, rejectReason: proposal.resolutionNote },
          })),
      })
    },
  )
}
