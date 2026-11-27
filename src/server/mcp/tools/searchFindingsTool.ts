import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { exposureNote } from '#core/exposureMeaning.ts'
import { FINDING_GROUP_KEYS, groupFindings, type FindingGroupKey } from '#core/findingGroups.ts'
import { SEVERITIES } from '#core/severity.ts'
import { cveUrl, imageUrl, linkBase } from '#core/siebLinks.ts'
import { listCurrentVersions } from '#server/db/findingVersions.ts'
import { findingFilterShape, toFindingQuery } from '#server/mcp/findingFilterSchema.ts'
import { searchFindings } from '#server/mcp/findingSearch.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'
import { READ_ONLY_TOOL, toolResult } from '#server/mcp/toolResult.ts'
import { exposureNoteSchema } from '#server/mcp/views/exposureNote.ts'
import { findingRowSchema, toFindingRow } from '#server/mcp/views/findingRow.ts'
import { lastSyncSchema, readLastSync } from '#server/mcp/views/lastSync.ts'

export const SEARCH_LIMIT_MAX = 50

const groupSchema = z.object({
  key: z.string(),
  count: z.number().int().describe('findings, CVE x image'),
  maxSeverity: z.enum(SEVERITIES),
  kevCount: z.number().int(),
  inboxCount: z.number().int(),
  imageCount: z.number().int(),
  vulnCount: z.number().int(),
  url: z
    .string()
    .nullable()
    .describe('sieb page of the CVE or image, null for namespace and package'),
})

const outputSchema = z.object({
  total: z.number().int().describe('matching findings, or groups with groupBy'),
  offset: z.number().int(),
  limit: z.number().int(),
  findings: z.array(findingRowSchema).optional(),
  groups: z.array(groupSchema).optional(),
  exposureNote: exposureNoteSchema
    .optional()
    .describe(
      'with findings: meaning of their exposure tiers plus what exposure does not cover, null when none carries an exposure label',
    ),
  notes: z.array(z.string()),
  lastSync: lastSyncSchema,
})

const inputSchema = z.object({
  ...findingFilterShape,
  groupBy: z
    .enum(['none', ...FINDING_GROUP_KEYS])
    .default('none')
    .describe('none lists findings, the others count findings per group'),
  limit: z.number().int().min(1).max(SEARCH_LIMIT_MAX).default(20),
  offset: z.number().int().min(0).default(0),
})

/**
 * Returns the sieb page of a group, where one exists.
 * @param {string} base - Link base
 * @param {FindingGroupKey} by - Grouping
 * @param {string} key - Group key
 * @returns {string | null} - URL, null for namespace and package groups
 */
const groupUrl = (base: string, by: FindingGroupKey, key: string): string | null => {
  if (by === 'cve') {
    return cveUrl(base, key)
  }

  return by === 'image' ? imageUrl(base, key) : null
}

/**
 * Registers search_findings: filtered findings in inbox order, or counts per group; pending
 * reads the Inbox of the connected user.
 * @param {McpServer} server - MCP server
 * @param {McpToolDeps} deps - Database, clock, KEV source and link base
 * @param {string} actor - sieb user of the caller
 * @returns {void}
 */
export const registerSearchFindingsTool = (
  server: McpServer,
  deps: McpToolDeps,
  actor: string,
): void => {
  server.registerTool(
    'search_findings',
    {
      title: 'Search findings',
      description:
        'Searches the findings sieb holds (one finding = one CVE in one image), in inbox order: KEV first, then exposure, severity and score. Combine filters to answer questions such as "critical openssl findings in public images" or "what is open in namespace X"; use groupBy for counts per CVE, image, namespace or package. Absence of a finding means sieb saw it in no scanned image, not that the cluster is safe. A filtered search returning 0: say so in the first line of your answer before you widen it and name the widened filter ("None with exposure public; widened to all exposures:").',
      inputSchema,
      outputSchema,
      annotations: READ_ONLY_TOOL,
    },
    (input) => {
      const base = linkBase(deps.baseUrl)
      const { findings, notes } = searchFindings(deps, toFindingQuery(input), actor)
      const page = {
        offset: input.offset,
        limit: input.limit,
        notes,
        lastSync: readLastSync(deps.db),
      }
      const end = input.offset + input.limit

      if (input.groupBy !== 'none') {
        const by = input.groupBy
        const groups = groupFindings(findings, by)

        return toolResult({
          total: groups.length,
          ...page,
          groups: groups
            .slice(input.offset, end)
            .map((group) => ({ ...group, url: groupUrl(base, by, group.key) })),
        })
      }

      const shown = findings.slice(input.offset, end)
      const versions = listCurrentVersions(
        deps.db,
        shown.map((finding) => finding.id),
      )

      return toolResult({
        total: findings.length,
        ...page,
        exposureNote: exposureNote(shown.map((finding) => finding.exposure)),
        findings: shown.map((finding) =>
          toFindingRow(finding, versions.get(finding.id) ?? [], base, deps.publicRegistries),
        ),
      })
    },
  )
}
