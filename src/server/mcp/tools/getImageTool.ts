import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { EXPOSURES } from '#core/exposure.ts'
import { exposureNote } from '#core/exposureMeaning.ts'
import { aggregateImages } from '#core/imageAggregation.ts'
import { withoutImageTag } from '#core/nameMatch.ts'
import { SEVERITIES } from '#core/severity.ts'
import { imageUrl, linkBase } from '#core/siebLinks.ts'
import { listFindingViews } from '#server/db/findingViews.ts'
import { listCurrentVersions } from '#server/db/findingVersions.ts'
import { isCheckImage, outsideCheckText } from '#server/mcp/checkScope.ts'
import type { CheckScope } from '#server/mcp/mcpCaller.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'
import { READ_ONLY_TOOL, toolError, toolResult } from '#server/mcp/toolResult.ts'
import { exposureNoteSchema } from '#server/mcp/views/exposureNote.ts'
import { findingRowSchema, toFindingRow } from '#server/mcp/views/findingRow.ts'
import { lastSyncSchema, readLastSync } from '#server/mcp/views/lastSync.ts'
import { toolImageSources } from '#server/mcp/mcpImageAccess.ts'

const MAX_FINDINGS = 50

const outputSchema = z.object({
  image: z.object({
    imageRef: z.string(),
    owner: z.string().nullable(),
    maxExposure: z.enum(EXPOSURES).nullable(),
    maxSeverity: z.enum(SEVERITIES),
    openCount: z.number().int().describe('open findings without the active not_affected ones'),
    openBySeverity: z.record(z.enum(SEVERITIES), z.number().int()),
    kevCount: z.number().int(),
    inboxCount: z.number().int(),
    notAffectedCount: z.number().int(),
    acceptedCount: z.number().int(),
    workloads: z.array(z.string()),
    url: z.string(),
  }),
  findings: z
    .array(findingRowSchema)
    .describe(`open findings in inbox order, at most ${MAX_FINDINGS}`),
  totalOpen: z.number().int().describe('open findings including not affected ones'),
  exposureNote: exposureNoteSchema,
  lastSync: lastSyncSchema,
})

const inputSchema = z.object({
  imageRef: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .describe('registry/repository, tag or digest is ignored, case-insensitive'),
})

/**
 * Registers get_image: one image's risk counts plus its open findings. A check caller may only
 * read its own image.
 * @param {McpServer} server - MCP server
 * @param {McpToolDeps} deps - Database, clock and link base
 * @param {CheckScope | null} scope - Check scope of an Auto-check caller, else null
 * @returns {void}
 */
export const registerGetImageTool = (
  server: McpServer,
  deps: McpToolDeps,
  scope: CheckScope | null = null,
): void => {
  server.registerTool(
    'get_image',
    {
      title: 'Get an image',
      description:
        'Reads one image: owner, exposure with what its tiers mean, risk counts by severity, KEV, inbox, not affected and accepted counts, workloads, and its open findings in inbox order.',
      inputSchema,
      outputSchema,
      annotations: READ_ONLY_TOOL,
    },
    ({ imageRef }) => {
      if (scope !== null && !isCheckImage(scope, imageRef)) {
        return toolError(outsideCheckText(scope))
      }

      const wanted = withoutImageTag(imageRef).toLowerCase()
      const findings = listFindingViews(deps.db, deps.clock(), { includeResolved: false }).filter(
        (finding) => finding.imageRef.toLowerCase() === wanted,
      )
      const [image] = aggregateImages(findings)

      if (!image) {
        return toolError(
          `sieb has no open finding in ${imageRef}; search_findings with images ["<prefix>*"] finds similar image refs`,
        )
      }

      const base = linkBase(deps.baseUrl)
      const sources = toolImageSources(deps)
      const shown = findings.slice(0, MAX_FINDINGS)
      const versions = listCurrentVersions(
        deps.db,
        shown.map((finding) => finding.id),
      )

      return toolResult({
        image: {
          imageRef: image.imageRef,
          owner: image.owner,
          maxExposure: image.maxExposure,
          maxSeverity: image.maxSeverity,
          openCount: image.openCount,
          openBySeverity: image.openBySeverity,
          kevCount: image.kevCount,
          inboxCount: image.inboxCount,
          notAffectedCount: image.notAffectedCount,
          acceptedCount: image.acceptedCount,
          workloads: image.workloads,
          url: imageUrl(base, image.imageRef),
        },
        findings: shown.map((finding) =>
          toFindingRow(finding, versions.get(finding.id) ?? [], base, sources),
        ),
        totalOpen: findings.length,
        exposureNote: exposureNote(findings.map((finding) => finding.exposure)),
        lastSync: readLastSync(deps.db),
      })
    },
  )
}
