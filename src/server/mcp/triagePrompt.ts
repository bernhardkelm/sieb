import type { GetPromptResult, McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { cveUrl, findingUrl, linkBase } from '#core/siebLinks.ts'
import { getFinding } from '#server/db/findingRepository.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'
import { triageWorkflow } from '#server/mcp/triagePromptText.ts'

const argsSchema = z.object({
  findingId: z.string().regex(/^\d+$/).optional().describe('sieb finding id'),
  vulnId: z.string().trim().min(1).max(100).optional().describe('vulnerability id, every image'),
})

/**
 * Describes what to investigate, with the tool that reads it and the sieb link.
 * @param {McpToolDeps} deps - Database and link base
 * @param {{ findingId?: string; vulnId?: string }} args - Prompt arguments
 * @returns {string} - Target paragraph
 */
const describeTarget = (
  deps: McpToolDeps,
  args: { findingId?: string; vulnId?: string },
): string => {
  const base = linkBase(deps.baseUrl)
  const finding = args.findingId ? getFinding(deps.db, Number(args.findingId)) : null

  if (finding) {
    return `Investigate sieb finding ${finding.id}: ${finding.vulnId} in the image ${finding.imageRef} (${findingUrl(base, finding.id)}). Start with get_finding { "findingId": ${finding.id} }.`
  }

  if (args.vulnId) {
    return `Investigate ${args.vulnId} across every image sieb found it in (${cveUrl(base, args.vulnId)}). Start with check_vulnerability { "vulnId": ${JSON.stringify(args.vulnId)} }.`
  }

  const unknown = args.findingId ? `sieb has no finding ${args.findingId}. ` : ''

  return `${unknown}Ask the user which finding or vulnerability to investigate, then start with get_finding or check_vulnerability.`
}

/**
 * Registers the triage_finding prompt: the investigation workflow for one finding or one
 * vulnerability, ending in propose_decision for a caller with sieb:propose, else in a structured
 * report back to the user.
 * @param {McpServer} server - MCP server
 * @param {McpToolDeps} deps - Database and link base
 * @param {boolean} canPropose - Whether the caller can call propose_decision
 * @returns {void}
 */
export const registerTriagePrompt = (
  server: McpServer,
  deps: McpToolDeps,
  canPropose = false,
): void => {
  server.registerPrompt(
    'triage_finding',
    {
      title: 'Triage a finding',
      description:
        'Investigates whether a sieb finding (findingId) or a vulnerability in every image (vulnId) affects us and reports the evidence in a fixed structure, or files it as a decision proposal when the connection may propose.',
      argsSchema,
    },
    (args): GetPromptResult => ({
      description: 'sieb triage workflow',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${describeTarget(deps, args)}\n\n${triageWorkflow(canPropose)}`,
          },
        },
      ],
    }),
  )
}
