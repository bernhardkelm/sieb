import type { McpServer, ToolAnnotations } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { ValidationIssue } from '#core/apiTypes.ts'
import { proposalReviewUrl } from '#core/inbox/inboxLinks.ts'
import { PATCH_ACTION_HINT } from '#core/patchAction.ts'
import type { ProposalClientKind } from '#core/proposalClient.ts'
import { validateProposalInput } from '#core/proposalValidation.ts'
import { linkBase } from '#core/siebLinks.ts'
import { createProposal } from '#server/db/createProposal.ts'
import { checkTargetError } from '#server/mcp/checkScope.ts'
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

/** Hints for the validation problems Claude can fix by itself, by field and code */
const PROBLEM_HINTS: Record<string, string> = {
  'fix.action:required': `required for needs_patch and fix_planned, ${PATCH_ACTION_HINT}`,
  'missing:required': 'required with inconclusive, what would be needed to decide',
  'missing:not_allowed': 'only with inconclusive, put open points of a verdict into unknowns',
}

/**
 * Describes one validation problem, with a hint for a missing patch action or missing list.
 * @param {ValidationIssue} error - Validation problem
 * @returns {string} - Field and code, or the field with its hint
 */
const problemText = ({ field, code }: ValidationIssue): string =>
  `${field ?? 'input'}: ${PROBLEM_HINTS[`${field}:${code}`] ?? code}`

/**
 * Returns the rate bucket of a caller: one per sieb user, shared by all of that user's tokens
 * and OAuth clients, and one per Auto-check, so a check never uses up its requester's quota.
 * @param {McpCaller} caller - Authenticated caller
 * @returns {string} - Limiter key
 */
const rateKeyOf = (caller: McpCaller): string =>
  caller.check === null ? `propose:${caller.actor}` : `propose:check:${caller.check.checkId}`

/**
 * Registers propose_decision, only for callers with sieb:propose: files a structured proposal a
 * human accepts, edits or rejects in sieb. At most PROPOSE_RATE_LIMIT valid calls per hour and
 * rate bucket, see rateKeyOf; each one is logged. An Auto-check may only propose for its own
 * finding.
 * @param {McpServer} server - MCP server
 * @param {McpToolDeps} deps - Database, clock, registries, logger, limiter and link base
 * @param {McpCaller} caller - Authenticated caller, the proposer
 * @param {ProposalClientKind | null} clientKind - Kind of Claude client of the request, null when unknown
 * @returns {void}
 */
export const registerProposeDecisionTool = (
  server: McpServer,
  deps: McpToolDeps,
  caller: McpCaller,
  clientKind: ProposalClientKind | null,
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
      const outside = checkTargetError(caller.check, { findingId, vulnId, imageRefs, all })

      if (outside !== null) {
        return toolError(outside)
      }

      const resolved = resolveProposalTarget(deps, { findingId, vulnId, imageRefs, all })

      if (!resolved.ok) {
        return toolError(resolved.message)
      }

      const validated = validateProposalInput({ ...claims, ...resolved.target }, now)

      if (!validated.ok) {
        const problems = validated.errors.map(problemText)

        return toolError(`invalid proposal, fix and retry: ${problems.join('; ')}`)
      }

      const retryAfter = deps.proposalLimiter.hit(rateKeyOf(caller), now.getTime())

      if (retryAfter !== null) {
        return toolError(`proposal limit reached, retry in ${retryAfter} seconds`)
      }

      const result = createProposal(deps.db, validated.value, {
        proposer: {
          proposedBy: caller.actor,
          proposedVia: caller.via,
          tokenId: caller.tokenId,
          clientLabel: caller.clientLabel,
          clientKind,
        },
        checkId: caller.check?.checkId ?? null,
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
