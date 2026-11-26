import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { DECISION_STATUSES } from '#core/decision.ts'
import { decisionCovers } from '#core/decisionApplicability.ts'
import { DECISION_FILTERS, matchesDecisionFilter } from '#core/decisionFilter.ts'
import type { DecisionView, FindingSummary } from '#core/findingView.ts'
import { groupBy } from '#core/groupBy.ts'
import { matchesAnyName, withoutImageTag } from '#core/nameMatch.ts'
import { linkBase } from '#core/siebLinks.ts'
import { listFindingSummaries } from '#server/db/findingRepository.ts'
import { listDecisionViews } from '#server/db/findingViews.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'
import { READ_ONLY_TOOL, toolResult } from '#server/mcp/toolResult.ts'
import { decisionSummarySchema, toDecisionSummary } from '#server/mcp/views/decisionSummary.ts'

const MAX_PACKAGES = 5

/**
 * Builds the schema of an optional name pattern.
 * @param {string} description - What the name is
 * @returns {z.ZodOptional<z.ZodString>} - Optional pattern schema
 */
const pattern = (description: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(256)
    .optional()
    .describe(`${description}; exact, or prefix with a trailing *, case-insensitive`)

const inputSchema = z.object({
  vulnId: pattern('vulnerability id'),
  package: pattern('package of a finding the decision covers'),
  image: pattern('image the decision is scoped to or covers, tag ignored'),
  state: z
    .enum(DECISION_FILTERS)
    .optional()
    .describe('decision state, expiring: active and expiring within 14 days'),
  status: z.enum(DECISION_STATUSES).optional(),
  limit: z.number().int().min(1).max(100).default(50),
})

const outputSchema = z.object({
  total: z.number().int(),
  decisions: z
    .array(
      decisionSummarySchema.extend({
        packages: z
          .array(z.string())
          .describe(`packages of covered findings, at most ${MAX_PACKAGES}`),
      }),
    )
    .describe('newest first'),
})

/**
 * Returns whether a decision covers a finding matching the package and image patterns.
 * @param {DecisionView} view - Decision
 * @param {readonly FindingSummary[]} covered - Findings the decision covers
 * @param {z.output<typeof inputSchema>} input - Filters
 * @returns {boolean} - True when every given pattern matches
 */
const matchesCovered = (
  view: DecisionView,
  covered: readonly FindingSummary[],
  input: z.output<typeof inputSchema>,
): boolean => {
  const image = input.image === undefined ? undefined : [withoutImageTag(input.image)]
  const images = [
    ...(view.decision.imageRef ? [view.decision.imageRef] : []),
    ...covered.map((finding) => finding.imageRef),
  ]

  return (
    matchesAnyName(images, image) &&
    matchesAnyName(
      covered.flatMap((finding) => finding.packages),
      input.package === undefined ? undefined : [input.package],
    )
  )
}

/**
 * Registers list_decisions: earlier verdicts on a CVE, package or image.
 * @param {McpServer} server - MCP server
 * @param {McpToolDeps} deps - Database, clock and link base
 * @returns {void}
 */
export const registerListDecisionsTool = (server: McpServer, deps: McpToolDeps): void => {
  server.registerTool(
    'list_decisions',
    {
      title: 'List decisions',
      description:
        'Lists triage decisions (not_affected, accepted, fix_planned) with their state, reason and author, newest first, so earlier verdicts on the same CVE, package or image can be followed. Revoked decisions are included unless a state filter excludes them.',
      inputSchema,
      outputSchema,
      annotations: READ_ONLY_TOOL,
    },
    (input) => {
      const now = deps.clock()
      const base = linkBase(deps.baseUrl)
      const byVuln = groupBy(listFindingSummaries(deps.db), (finding) => finding.vulnId)
      const matches = listDecisionViews(deps.db, now).flatMap((view) => {
        const covered = (byVuln.get(view.decision.vulnId) ?? []).filter((finding) =>
          decisionCovers(view.decision, finding),
        )
        const keep =
          matchesAnyName([view.decision.vulnId], input.vulnId ? [input.vulnId] : undefined) &&
          (input.state === undefined || matchesDecisionFilter(view, input.state, now)) &&
          (input.status === undefined || view.decision.status === input.status) &&
          matchesCovered(view, covered, input)
        const packages = [...new Set(covered.flatMap((finding) => finding.packages))].sort()

        return keep
          ? [{ ...toDecisionSummary(view, base), packages: packages.slice(0, MAX_PACKAGES) }]
          : []
      })

      return toolResult({ total: matches.length, decisions: matches.slice(0, input.limit) })
    },
  )
}
