import type { FindingView } from '#core/findingView.ts'
import { isAcceptedFinding, isNotAffectedFinding } from '#core/findingDecisionState.ts'
import { groupBy } from '#core/groupBy.ts'
import { compareExposure, maxExposure, type Exposure } from '#core/exposure.ts'
import { compareOwner, firstOwner } from '#core/owner.ts'
import { compareSeverity, maxSeverity, SEVERITIES, type Severity } from '#core/severity.ts'

/** Risk counts of an image over a set of its open findings */
export interface ImageRiskCounts {
  maxSeverity: Severity // of the counted findings, else of all open, else of all findings
  openCount: number
  openBySeverity: Record<Severity, number>
  fixableCount: number // every finding has a fixed version
  kevCount: number
}

/**
 * Findings of one image_ref. The risk counts leave out open findings governed by an active
 * not_affected decision, includingNotAffected holds the same counts over every open finding.
 */
export interface ImageAggregate extends ImageRiskCounts {
  imageRef: string
  owner: string | null // self first, then alphabetical when the workloads disagree
  maxExposure: Exposure | null // null when the most exposed workload has no exposure label
  inboxCount: number
  notAffectedCount: number // open findings governed by an active not_affected decision
  acceptedCount: number // open findings governed by an active accepted decision, part of the risk counts
  workloadCount: number
  workloads: string[] // "namespace/kind/name", sorted
  includingNotAffected: ImageRiskCounts
}

/**
 * Counts a set of open findings of an image.
 * @param {readonly FindingView[]} counted - Open findings to count
 * @param {readonly FindingView[]} fallback - Findings whose highest severity applies without counted ones
 * @returns {ImageRiskCounts} - Counts
 */
const countRisk = (
  counted: readonly FindingView[],
  fallback: readonly FindingView[],
): ImageRiskCounts => {
  const openBySeverity = Object.fromEntries(SEVERITIES.map((severity) => [severity, 0])) as Record<
    Severity,
    number
  >

  for (const finding of counted) {
    openBySeverity[finding.severity] += 1
  }

  return {
    maxSeverity: maxSeverity(
      (counted.length > 0 ? counted : fallback).map((finding) => finding.severity),
    ),
    openCount: counted.length,
    openBySeverity,
    fixableCount: counted.length,
    kevCount: counted.filter((finding) => finding.kev).length,
  }
}

/**
 * Aggregates the findings of one image.
 * @param {string} imageRef - Image
 * @param {readonly FindingView[]} findings - Its findings, at least one
 * @returns {ImageAggregate} - Aggregate
 */
const aggregateImage = (imageRef: string, findings: readonly FindingView[]): ImageAggregate => {
  const open = findings.filter((finding) => finding.resolvedAt === null)
  const atRisk = open.filter((finding) => !isNotAffectedFinding(finding))
  const includingNotAffected = countRisk(open, findings)
  const workloads = [...new Set(findings.flatMap((finding) => finding.workloads))].sort()

  return {
    imageRef,
    owner: firstOwner(findings.map((finding) => finding.owner)),
    maxExposure: maxExposure(findings.map((finding) => finding.exposure)),
    ...countRisk(atRisk, open.length > 0 ? open : findings),
    inboxCount: findings.filter((finding) => finding.inInbox).length,
    notAffectedCount: open.length - atRisk.length,
    acceptedCount: open.filter(isAcceptedFinding).length,
    workloadCount: workloads.length,
    workloads,
    includingNotAffected,
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
 * Returns an image with its risk counts over every open finding, not affected ones included.
 * @param {ImageAggregate} image - Image
 * @returns {ImageAggregate} - Image whose top-level counts include not affected findings
 */
export const withNotAffected = (image: ImageAggregate): ImageAggregate => ({
  ...image,
  ...image.includingNotAffected,
})

/**
 * Returns whether every open finding of an image is governed by an active not_affected decision.
 * @param {Pick<ImageAggregate, 'openCount' | 'notAffectedCount'>} image - Image risk counts
 * @returns {boolean} - True when not affected findings are all it has open
 */
export const isOnlyNotAffected = (
  image: Pick<ImageAggregate, 'openCount' | 'notAffectedCount'>,
): boolean => image.openCount === 0 && image.notAffectedCount > 0

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
