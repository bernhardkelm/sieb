import type { McpServer, ToolAnnotations } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { ValidationIssue } from '#core/errorApiTypes.ts'
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

export const PROPOSAL_NOTE =
  'Nothing changed yet; a human must accept this in sieb. Now reply in the sieb format, nothing else: the first line with verdict, confidence and, for needs_patch and fix_planned, the patch action or "waiting for upstream"; Why in at most 25 words; Checked and Not checked with keywords only; then the Proposal line with this url.'

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
  'fix.availability:required':
    'required with fix_planned: available when a fix is published at a layer you control, else upstream_pending',
  'fix.availability:not_allowed':
    'needs_patch means a published fix; without one use fix_planned with upstream_pending',
  'fix.waitingFor:required': 'required with upstream_pending, the release or image you wait for',
  'fix.waitingFor:not_allowed': 'only with fix_planned and availability upstream_pending',
  'fix.interim:not_allowed': 'only with fix_planned and availability upstream_pending',
  'review.date:required': 'required with upstream_pending, when to look for the upstream fix again',
  'relatedFindings.findingId:unknown_finding':
    'no open finding with this id, take ids from get_image',
  'relatedFindings.findingId:is_target': 'the target itself, list only other findings',
  'relatedFindings.findingId:outside_image':
    'an Auto-check lists only findings on its own image, from get_image',
  'relatedFindings.findingId:duplicate': 'list each finding once',
  'relatedReason:not_allowed': 'only with relatedFindings',
}

/**
 * Describes one validation problem, with the hint of its field and code; list entries such as
 * relatedFindings.2.findingId share the hint of relatedFindings.findingId.
 * @param {ValidationIssue} error - Validation problem
 * @returns {string} - Field and code, or the field with its hint
 */
const problemText = ({ field, code }: ValidationIssue): string =>
  `${field ?? 'input'}: ${PROBLEM_HINTS[`${field?.replaceAll(/\.\d+(?=\.|$)/gu, '')}:${code}`] ?? code}`

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
 * finding and list related findings only on its image.
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
        'Files a structured triage proposal for a CVE in one or more images (findingId alone, or vulnId with imageRefs) or in every image (vulnId with all: true); findingId cannot be combined with vulnId, imageRefs or all. Nothing changes and no alert is muted until a human accepts it in sieb. A new proposal for the same target replaces your open one. Returns the review URL. File one at the end of every triage without asking, inconclusive included; call list_my_proposals first and do not repeat a rejected proposal without new evidence.',
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

      if (!result.ok && result.error === 'invalid_related') {
        const problems = (result.issues ?? []).map(problemText)

        return toolError(`invalid proposal, fix and retry: ${problems.join('; ')}`)
      }

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
