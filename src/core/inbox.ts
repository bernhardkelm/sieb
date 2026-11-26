import { leavesInbox, type EffectiveDecision } from '#core/effectiveDecision.ts'
import type { Finding } from '#core/finding.ts'
import { compareExposure } from '#core/exposure.ts'
import { compareSeverity } from '#core/severity.ts'

export type InboxSortFields = Pick<
  Finding,
  'kev' | 'exposure' | 'severity' | 'score' | 'vulnId' | 'imageRef'
>

/**
 * Returns whether a finding belongs in the inbox: still open and not governed by an active or
 * fix_planned decision. Expired, revoked and re-opened decisions send it back.
 * @param {Pick<Finding, 'resolvedAt'>} finding - Finding
 * @param {EffectiveDecision | null} effective - State of its governing decision, null for none
 * @returns {boolean} - True when the finding needs triage
 */
export const isInInbox = (
  finding: Pick<Finding, 'resolvedAt'>,
  effective: EffectiveDecision | null,
): boolean => finding.resolvedAt === null && (effective === null || !leavesInbox(effective))

/**
 * Compares two findings in inbox order: KEV first, then exposure public > gated > unknown >
 * internal, then severity, then score descending with missing scores last, then vuln_id and image_ref.
 * @param {InboxSortFields} a - First finding
 * @param {InboxSortFields} b - Second finding
 * @returns {number} - Negative when a sorts before b
 */
export const compareInbox = (a: InboxSortFields, b: InboxSortFields): number =>
  Number(b.kev) - Number(a.kev) ||
  compareExposure(a.exposure, b.exposure) ||
  compareSeverity(a.severity, b.severity) ||
  (b.score ?? -1) - (a.score ?? -1) ||
  a.vulnId.localeCompare(b.vulnId) ||
  a.imageRef.localeCompare(b.imageRef)
