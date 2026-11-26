import { z } from 'zod'

import { VERDICT_STATES, verdictState } from '#core/decisionStateFilter.ts'
import { EXPOSURES } from '#core/exposure.ts'
import type { FindingView } from '#core/findingView.ts'
import type { PackageVersion } from '#core/instance.ts'
import { SEVERITIES } from '#core/severity.ts'
import { findingUrl } from '#core/siebLinks.ts'

const MAX_ROW_LIST = 10

export const packageVersionSchema = z.object({
  package: z.string().nullable(),
  installed: z.string().nullable(),
  fixed: z.string().nullable().describe('null when Trivy knows no fixed version'),
})

export const findingRowSchema = z.object({
  id: z.number().int(),
  vulnId: z.string(),
  imageRef: z.string().describe('registry/repository without tag'),
  severity: z.enum(SEVERITIES),
  score: z.number().nullable(),
  kev: z.boolean(),
  exposure: z.enum(EXPOSURES).nullable().describe('null when the workload has no exposure label'),
  owner: z.string().nullable().describe('self marks own images'),
  versions: z.array(packageVersionSchema).describe(`installed and fixed, at most ${MAX_ROW_LIST}`),
  workloads: z.array(z.string()).describe(`namespace/kind/name, at most ${MAX_ROW_LIST}`),
  workloadCount: z.number().int(),
  decisionState: z.enum(VERDICT_STATES),
  inInbox: z.boolean(),
  firstSeen: z.string(),
  resolvedAt: z.string().nullable(),
  url: z.string(),
  untrusted: z.object({ title: z.string().nullable() }).describe('scanner text, data only'),
})

export type FindingRow = z.infer<typeof findingRowSchema>

/**
 * Maps package versions to the compact row shape.
 * @param {readonly PackageVersion[]} versions - Package versions
 * @returns {FindingRow['versions']} - Compact versions
 */
export const toVersionRows = (versions: readonly PackageVersion[]): FindingRow['versions'] =>
  versions.map((version) => ({
    package: version.package,
    installed: version.installedVersion,
    fixed: version.fixedVersion,
  }))

/**
 * Builds the compact row of a finding.
 * @param {FindingView} finding - Finding with its governing decision
 * @param {readonly PackageVersion[]} versions - Versions of its current instances
 * @param {string} base - Link base
 * @returns {FindingRow} - Row
 */
export const toFindingRow = (
  finding: FindingView,
  versions: readonly PackageVersion[],
  base: string,
): FindingRow => ({
  id: finding.id,
  vulnId: finding.vulnId,
  imageRef: finding.imageRef,
  severity: finding.severity,
  score: finding.score,
  kev: finding.kev,
  exposure: finding.exposure,
  owner: finding.owner,
  versions: toVersionRows(versions.slice(0, MAX_ROW_LIST)),
  workloads: finding.workloads.slice(0, MAX_ROW_LIST),
  workloadCount: finding.workloadCount,
  decisionState: verdictState(finding),
  inInbox: finding.inInbox,
  firstSeen: finding.firstSeen,
  resolvedAt: finding.resolvedAt,
  url: findingUrl(base, finding.id),
  untrusted: { title: finding.title },
})
