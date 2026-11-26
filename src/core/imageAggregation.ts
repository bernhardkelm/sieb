import type { FindingView } from '#core/findingView.ts'
import { isSuppressedFinding } from '#core/findingDecisionState.ts'
import { groupBy } from '#core/groupBy.ts'
import { compareExposure, maxExposure, type Exposure } from '#core/exposure.ts'
import { compareOwner, firstOwner } from '#core/owner.ts'
import { compareSeverity, maxSeverity, SEVERITIES, type Severity } from '#core/severity.ts'

/** Findings of one image_ref, counts over its open findings */
export interface ImageAggregate {
  imageRef: string
  owner: string | null // self first, then alphabetical when the workloads disagree
  maxExposure: Exposure | null // null when the most exposed workload has no exposure label
  maxSeverity: Severity
  openCount: number
  openBySeverity: Record<Severity, number>
  fixableCount: number // every finding has a fixed version
  kevCount: number
  inboxCount: number
  suppressedCount: number
  workloadCount: number
  workloads: string[] // "namespace/kind/name", sorted
}

/**
 * Aggregates the findings of one image.
 * @param {string} imageRef - Image
 * @param {readonly FindingView[]} findings - Its findings, at least one
 * @returns {ImageAggregate} - Aggregate
 */
const aggregateImage = (imageRef: string, findings: readonly FindingView[]): ImageAggregate => {
  const open = findings.filter((finding) => finding.resolvedAt === null)
  const openBySeverity = Object.fromEntries(SEVERITIES.map((severity) => [severity, 0])) as Record<
    Severity,
    number
  >

  for (const finding of open) {
    openBySeverity[finding.severity] += 1
  }

  const workloads = [...new Set(findings.flatMap((finding) => finding.workloads))].sort()

  return {
    imageRef,
    owner: firstOwner(findings.map((finding) => finding.owner)),
    maxExposure: maxExposure(findings.map((finding) => finding.exposure)),
    maxSeverity: maxSeverity(
      (open.length > 0 ? open : findings).map((finding) => finding.severity),
    ),
    openCount: open.length,
    openBySeverity,
    fixableCount: open.length,
    kevCount: open.filter((finding) => finding.kev).length,
    inboxCount: findings.filter((finding) => finding.inInbox).length,
    suppressedCount: findings.filter(isSuppressedFinding).length,
    workloadCount: workloads.length,
    workloads,
  }
}

/**
 * Compares two images: own images first, then other owners alphabetically, images without
 * owner last, then by exposure, highest severity, open count and image_ref.
 * @param {ImageAggregate} a - First image
 * @param {ImageAggregate} b - Second image
 * @returns {number} - Negative when a sorts before b
 */
export const compareImages = (a: ImageAggregate, b: ImageAggregate): number =>
  compareOwner(a.owner, b.owner) ||
  compareExposure(a.maxExposure, b.maxExposure) ||
  compareSeverity(a.maxSeverity, b.maxSeverity) ||
  b.openCount - a.openCount ||
  a.imageRef.localeCompare(b.imageRef)

/**
 * Aggregates findings per image_ref. Counts cover open findings, exposure, owner and workloads
 * all given findings, so pass open findings only unless resolved ones should show.
 * @param {readonly FindingView[]} findings - Findings with their governing decision
 * @returns {ImageAggregate[]} - One aggregate per image, sorted by compareImages
 */
export const aggregateImages = (findings: readonly FindingView[]): ImageAggregate[] =>
  [...groupBy(findings, (finding) => finding.imageRef)]
    .map(([imageRef, group]) => aggregateImage(imageRef, group))
    .sort(compareImages)
