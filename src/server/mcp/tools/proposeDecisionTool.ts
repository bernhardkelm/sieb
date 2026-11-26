import type { McpServer, ToolAnnotations } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { proposalReviewUrl } from '#core/inbox/inboxLinks.ts'
import { validateProposalInput } from '#core/proposalValidation.ts'
import { linkBase } from '#core/siebLinks.ts'
import { createProposal } from '#server/db/createProposal.ts'
import type { McpCaller } from '#server/mcp/mcpCaller.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'
import { resolveProposalTarget } from '#server/mcp/proposalTarget.ts'
import { proposeDecisionInput as inputSchema } from '#server/mcp/tools/proposeDecisionInput.ts'
import { toolError, toolResult } from '#server/mcp/toolResult.ts'
import { proposeLogLine } from '#server/proposalLogLines.ts'

export const PROPOSAL_NOTE = 'Nothing changed yet; a human must accept this in sieb.'

/** Writes a proposal row only, never a decision */
const PROPOSE_TOOL: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
}

const outputSchema = z.object({
  proposalId: z.number().int(),
  url: z.string().describe('review page in sieb, end your answer with it'),
  replacedProposalId: z
    .number()
    .int()
    .optional()
    .describe('your earlier open proposal for the same target'),
  note: z.string(),
})

/**
 * Registers propose_decision, only for callers with sieb:propose: files a structured proposal a
 * human accepts, edits or rejects in sieb. At most PROPOSE_RATE_LIMIT valid calls per hour and
 * sieb user, shared by all of that user's tokens and OAuth clients; each one is logged.
 * @param {McpServer} server - MCP server
 * @param {McpToolDeps} deps - Database, clock, registries, logger, limiter and link base
 * @param {McpCaller} caller - Authenticated caller, the proposer
 * @returns {void}
 */
export const registerProposeDecisionTool = (
  server: McpServer,
  deps: McpToolDeps,
  caller: McpCaller,
): void => {
  server.registerTool(
    'propose_decision',
    {
      title: 'Propose a decision',
      description:
        'Files a structured triage proposal for a CVE in one or more images (findingId alone, or vulnId with imageRefs) or in every image (vulnId with all: true); findingId cannot be combined with vulnId, imageRefs or all. Nothing changes and no alert is muted until a human accepts it in sieb. A new proposal for the same target replaces your open one. Returns the review URL.',
      inputSchema,
      outputSchema,
      annotations: PROPOSE_TOOL,
    },
    (input) => {
      const now = deps.clock()
      const { findingId, vulnId, imageRefs, all, ...claims } = input
      const resolved = resolveProposalTarget(deps, { findingId, vulnId, imageRefs, all })

      if (!resolved.ok) {
        return toolError(resolved.message)
      }

      const validated = validateProposalInput({ ...claims, ...resolved.target }, now)

      if (!validated.ok) {
        const problems = validated.errors.map((error) => `${error.field ?? 'input'}: ${error.code}`)

        return toolError(`invalid proposal, fix and retry: ${problems.join('; ')}`)
      }

      const retryAfter = deps.proposalLimiter.hit(`propose:${caller.actor}`, now.getTime())

      if (retryAfter !== null) {
        return toolError(`proposal limit reached, retry in ${retryAfter} seconds`)
      }

      const result = createProposal(deps.db, validated.value, {
        proposer: {
          proposedBy: caller.actor,
          proposedVia: caller.via,
          tokenId: caller.tokenId,
          clientLabel: caller.clientLabel,
        },
        publicRegistries: deps.publicRegistries,
        now,
      })

      if (!result.ok) {
        return toolError(
          result.error === 'unknown_finding'
            ? `no open finding of ${validated.value.vulnId} in ${result.imageRefs?.join(', ') || 'any image'}; proposals need open findings`
            : 'you hold too many open proposals; wait until some are reviewed',
        )
      }

      deps.log(proposeLogLine(result.proposal, result.replacedProposalId))

      return toolResult({
        proposalId: result.proposal.id,
        url: proposalReviewUrl(linkBase(deps.baseUrl), result.proposal.id),
        ...(result.replacedProposalId === null
          ? {}
          : { replacedProposalId: result.replacedProposalId }),
        note: PROPOSAL_NOTE,
      })
    },
  )
}
