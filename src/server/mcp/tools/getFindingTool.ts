import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { DECISION_EVENT_TYPES } from '#core/decisionEvent.ts'
import { distinctPackageVersions } from '#core/instance.ts'
import { withoutImageTag } from '#core/nameMatch.ts'
import { cveUrl, imageUrl, linkBase } from '#core/siebLinks.ts'
import { listFindingsByVuln } from '#server/db/findingRepository.ts'
import { getFindingDetail } from '#server/db/findingViews.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'
import { READ_ONLY_TOOL, toolError, toolResult } from '#server/mcp/toolResult.ts'
import {
  kevFactsSchema,
  referenceLinksSchema,
  toAdvisoryFacts,
  untrustedAdvisorySchema,
} from '#server/mcp/views/advisoryFacts.ts'
import { instanceRowSchema, toInstanceRow } from '#server/mcp/views/affectedImage.ts'
import { decisionSummarySchema, toDecisionSummary } from '#server/mcp/views/decisionSummary.ts'
import { findingRowSchema, toFindingRow } from '#server/mcp/views/findingRow.ts'

const MAX_INSTANCES = 50

const outputSchema = z.object({
  finding: findingRowSchema.extend({ lastSeen: z.string() }),
  instances: z
    .array(
      instanceRowSchema.extend({
        firstSeen: z.string(),
        lastSeen: z.string(),
        resolvedAt: z.string().nullable(),
      }),
    )
    .describe(`open first, at most ${MAX_INSTANCES}`),
  instanceCount: z.number().int(),
  decisions: z
    .array(decisionSummarySchema.extend({ governing: z.boolean() }))
    .describe('every decision covering the finding, revoked ones included, newest first'),
  events: z
    .array(
      z.object({
        decisionId: z.number().int(),
        type: z.enum(DECISION_EVENT_TYPES),
        actor: z.string(),
        at: z.string(),
        untrusted: z.object({
          payload: z
            .record(z.string(), z.unknown())
            .describe('user-written values; updated: field -> [before, after]'),
        }),
      }),
    )
    .describe('history of those decisions, oldest first'),
  kevCatalog: kevFactsSchema,
  references: referenceLinksSchema,
  cveUrl: z.string(),
  imageUrl: z.string(),
  untrusted: untrustedAdvisorySchema,
})

const inputSchema = z.object({
  findingId: z.number().int().positive().optional(),
  vulnId: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe('with imageRef, instead of findingId'),
  imageRef: z.string().trim().min(1).max(512).optional().describe('tag or digest is ignored'),
})

/**
 * Resolves the finding id of a vulnerability in an image, case-insensitive.
 * @param {McpToolDeps} deps - Database
 * @param {string} vulnId - Vulnerability id
 * @param {string} imageRef - Image ref, tag and digest ignored
 * @returns {number | null} - Finding id, null when sieb never saw the pair
 */
const findFindingId = ({ db }: McpToolDeps, vulnId: string, imageRef: string): number | null => {
  const wanted = withoutImageTag(imageRef).toLowerCase()
  const candidates = [vulnId, vulnId.toUpperCase()].flatMap((id) => listFindingsByVuln(db, id))

  return candidates.find((finding) => finding.imageRef.toLowerCase() === wanted)?.id ?? null
}

/**
 * Registers get_finding: one finding with instances, decisions, history and KEV details.
 * @param {McpServer} server - MCP server
 * @param {McpToolDeps} deps - Database, clock, KEV source and link base
 * @returns {void}
 */
export const registerGetFindingTool = (server: McpServer, deps: McpToolDeps): void => {
  server.registerTool(
    'get_finding',
    {
      title: 'Get a finding',
      description:
        'Reads one finding (a CVE in one image) by findingId, or by vulnId plus imageRef: its instances per workload and container with package versions, every decision covering it with reasons and history, CISA KEV details and links.',
      inputSchema,
      outputSchema,
      annotations: READ_ONLY_TOOL,
    },
    (input) => {
      const id =
        input.findingId ??
        (input.vulnId && input.imageRef ? findFindingId(deps, input.vulnId, input.imageRef) : null)

      if (id === null) {
        return toolError(
          input.vulnId && input.imageRef
            ? `sieb has no finding of ${input.vulnId} in ${input.imageRef}; use check_vulnerability to list the images it is in`
            : 'pass findingId, or vulnId together with imageRef',
        )
      }

      const detail = getFindingDetail(deps.db, id, deps.clock(), deps.kevSource === 'cisa')

      if (!detail) {
        return toolError(`unknown finding ${id}`)
      }

      const base = linkBase(deps.baseUrl)
      const { finding, instances } = detail
      const current = instances.filter(
        (instance) => instance.resolvedAt === null || instance.resolvedAt === finding.resolvedAt,
      )

      return toolResult({
        finding: {
          ...toFindingRow(finding, distinctPackageVersions(current), base),
          lastSeen: finding.lastSeen,
        },
        instances: instances.slice(0, MAX_INSTANCES).map((instance) => ({
          ...toInstanceRow(instance),
          firstSeen: instance.firstSeen,
          lastSeen: instance.lastSeen,
          resolvedAt: instance.resolvedAt,
        })),
        instanceCount: instances.length,
        decisions: detail.decisions.map((view) => ({
          ...toDecisionSummary(view, base),
          governing: view.decision.id === finding.decision?.id,
        })),
        events: detail.events.map((event) => ({
          decisionId: event.decisionId,
          type: event.type,
          actor: event.actor,
          at: event.at,
          untrusted: { payload: event.payload },
        })),
        ...toAdvisoryFacts(finding, detail.kev),
        cveUrl: cveUrl(base, finding.vulnId),
        imageUrl: imageUrl(base, finding.imageRef),
      })
    },
  )
}
