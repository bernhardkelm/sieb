import { z } from 'zod'

import { VERDICT_STATES, verdictState } from '#core/decisionStateFilter.ts'
import { EXPOSURES } from '#core/exposure.ts'
import type { FindingView } from '#core/findingView.ts'
import type { FindingInstance } from '#core/instance.ts'
import { SEVERITIES } from '#core/severity.ts'
import { findingUrl } from '#core/siebLinks.ts'
import { SOURCE_ACCESS_LEVELS, sourceAccess } from '#core/sourceAccess.ts'
import { decisionSummarySchema, type DecisionSummary } from '#server/mcp/views/decisionSummary.ts'

const MAX_INSTANCES = 20

export const instanceRowSchema = z.object({
  workload: z.string().describe('namespace/kind/name'),
  container: z.string().nullable(),
  imageTag: z.string().nullable(),
  package: z.string().nullable(),
  installed: z.string().nullable(),
  fixed: z.string().nullable(),
})

export const affectedImageSchema = z.object({
  findingId: z.number().int(),
  imageRef: z.string(),
  severity: z.enum(SEVERITIES),
  score: z.number().nullable(),
  kev: z.boolean(),
  exposure: z.enum(EXPOSURES).nullable(),
  owner: z.string().nullable(),
  sourceAccess: z
    .enum(SOURCE_ACCESS_LEVELS)
    .describe(
      'public: upstream source and image can be checked, private or unknown: advisory-level only',
    ),
  decisionState: z.enum(VERDICT_STATES),
  decision: decisionSummarySchema.nullable().describe('governing decision'),
  instances: z.array(instanceRowSchema).describe(`open instances, at most ${MAX_INSTANCES}`),
  instanceCount: z.number().int(),
  firstSeen: z.string(),
  url: z.string(),
})

export const pastImageSchema = z.object({
  findingId: z.number().int(),
  imageRef: z.string(),
  firstSeen: z.string(),
  resolvedAt: z.string(),
  note: z.string(),
  url: z.string(),
})

/**
 * Maps an instance to its compact row.
 * @param {FindingInstance} instance - Instance
 * @returns {z.infer<typeof instanceRowSchema>} - Row
 */
export const toInstanceRow = (instance: FindingInstance): z.infer<typeof instanceRowSchema> => ({
  workload: `${instance.namespace}/${instance.resourceKind}/${instance.resourceName}`,
  container: instance.container,
  imageTag: instance.imageTag,
  package: instance.package,
  installed: instance.installedVersion,
  fixed: instance.fixedVersion,
})

/**
 * Describes one image an open finding of a vulnerability is in.
 * @param {FindingView} finding - Open finding
 * @param {readonly FindingInstance[]} instances - Its instances, resolved ones included
 * @param {DecisionSummary | null} decision - Its governing decision
 * @param {string} base - Link base
 * @param {readonly string[]} publicRegistries - Registries whose images count as public
 * @returns {z.infer<typeof affectedImageSchema>} - Affected image
 */
export const toAffectedImage = (
  finding: FindingView,
  instances: readonly FindingInstance[],
  decision: DecisionSummary | null,
  base: string,
  publicRegistries: readonly string[],
): z.infer<typeof affectedImageSchema> => {
  const open = instances.filter((instance) => instance.resolvedAt === null)

  return {
    findingId: finding.id,
    imageRef: finding.imageRef,
    severity: finding.severity,
    score: finding.score,
    kev: finding.kev,
    exposure: finding.exposure,
    owner: finding.owner,
    sourceAccess: sourceAccess(finding.imageRef, finding.owner, publicRegistries),
    decisionState: verdictState(finding),
    decision,
    instances: open.slice(0, MAX_INSTANCES).map(toInstanceRow),
    instanceCount: open.length,
    firstSeen: finding.firstSeen,
    url: findingUrl(base, finding.id),
  }
}

/**
 * Describes an image a vulnerability was found in before it resolved.
 * @param {FindingView & { resolvedAt: string }} finding - Resolved finding
 * @param {string} base - Link base
 * @returns {z.infer<typeof pastImageSchema>} - Past image
 */
export const toPastImage = (
  finding: FindingView & { resolvedAt: string },
  base: string,
): z.infer<typeof pastImageSchema> => ({
  findingId: finding.id,
  imageRef: finding.imageRef,
  firstSeen: finding.firstSeen,
  resolvedAt: finding.resolvedAt,
  note: `was present in ${finding.imageRef} until ${finding.resolvedAt}`,
  url: findingUrl(base, finding.id),
})
