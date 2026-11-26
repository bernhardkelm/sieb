import { z } from 'zod'

import { DECISION_STATE_FILTERS } from '#core/decisionStateFilter.ts'
import { EXPOSURES } from '#core/exposure.ts'
import type { FindingQuery } from '#core/findingQuery.ts'
import { OWNER_MAX_LENGTH } from '#core/owner.ts'
import { NAME_PATTERN_MAX_LENGTH } from '#core/queryParamReaders.ts'
import { SEVERITIES } from '#core/severity.ts'

const MAX_PATTERNS = 50

/**
 * Builds the schema of a list of name patterns.
 * @param {string} description - What the names are
 * @returns {z.ZodOptional<z.ZodArray<z.ZodString>>} - Optional list schema
 */
const namePatterns = (description: string) =>
  z
    .array(z.string().trim().min(1).max(NAME_PATTERN_MAX_LENGTH))
    .max(MAX_PATTERNS)
    .optional()
    .describe(`${description}; exact match, or prefix with a trailing *, case-insensitive`)

const timestamp = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'expected an ISO date or date-time')

export const findingFilterShape = {
  text: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe('free text over CVE id, title, package, image, namespace and workload'),
  vulnIds: namePatterns('vulnerability ids such as CVE-2024-3094'),
  packages: namePatterns('package names such as openssl or libssl3'),
  images: namePatterns('image refs, a tag or digest is ignored'),
  namespaces: namePatterns('Kubernetes namespaces'),
  workloads: namePatterns('workloads as namespace/kind/name, namespace/name or name'),
  severity: z.array(z.enum(SEVERITIES)).optional(),
  minScore: z.number().min(0).max(10).optional().describe('CVSS score at or above it'),
  kev: z.boolean().optional().describe('true keeps KEV listed findings only'),
  exposure: z
    .array(z.enum(EXPOSURES))
    .optional()
    .describe('public, gated (behind auth) or internal; drops findings without exposure label'),
  owner: z
    .array(z.string().trim().min(1).max(OWNER_MAX_LENGTH))
    .optional()
    .describe('owner labels, self marks own images'),
  decisionState: z
    .array(z.enum(DECISION_STATE_FILTERS))
    .optional()
    .describe('state of the governing decision, active covers active not_affected and accepted'),
  firstSeenSince: timestamp.optional().describe('first seen at or after, ISO date or date-time'),
  kevAddedSince: timestamp
    .optional()
    .describe('added to the CISA KEV catalog on or after, needs the cisa KEV source'),
  fixable: z.boolean().optional().describe('true: a fixed version is known, false: none is'),
  view: z
    .enum(['inbox', 'all'])
    .default('all')
    .describe('inbox: open findings still needing a decision, all: every open finding'),
  includeResolved: z.boolean().default(false).describe('view all only, adds resolved findings'),
}

const findingFilterSchema = z.object(findingFilterShape)

export type FindingFilterInput = z.output<typeof findingFilterSchema>

/**
 * Maps the MCP filter arguments onto the core finding query.
 * @param {FindingFilterInput} input - Validated arguments
 * @returns {FindingQuery} - Query for filterFindings
 */
export const toFindingQuery = (input: FindingFilterInput): FindingQuery => ({
  view: input.view,
  includeResolved: input.includeResolved,
  q: input.text || null,
  severity: input.severity ?? [],
  exposure: input.exposure ?? [],
  owner: input.owner ?? [],
  newSince: input.firstSeenSince ? new Date(Date.parse(input.firstSeenSince)).toISOString() : null,
  kev: input.kev ?? false,
  vulnIds: input.vulnIds,
  packages: input.packages,
  images: input.images,
  namespaces: input.namespaces,
  workloads: input.workloads,
  minScore: input.minScore ?? null,
  decisionState: input.decisionState,
  kevAddedSince: input.kevAddedSince
    ? new Date(Date.parse(input.kevAddedSince)).toISOString().slice(0, 10)
    : null,
  fixable: input.fixable ?? null,
})
