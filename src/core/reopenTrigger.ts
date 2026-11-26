import type { ReopenReason } from '#core/effectiveDecision.ts'
import type { Finding } from '#core/finding.ts'
import { compareSeverity, isSeverityHigher, type Severity } from '#core/severity.ts'

/** Severity and KEV listing of one governed image when the decision was made or re-confirmed */
export interface DecisionBaseline {
  imageRef: string
  severity: Severity
  kev: boolean
  recordedAt: string
}

/** Governed image whose finding now ranks above its baseline */
export interface ReopenTrigger {
  reason: ReopenReason
  imageRef: string
  severity: Severity // current severity of the finding
  kev: boolean // current KEV listing of the finding
  baselineSeverity: Severity
  baselineKev: boolean
}

export type BaselineSubject = Pick<Finding, 'imageRef' | 'severity' | 'kev'>

/**
 * Compares two triggers: KEV listings first, then the most severe finding, then image_ref.
 * @param {ReopenTrigger} a - First trigger
 * @param {ReopenTrigger} b - Second trigger
 * @returns {number} - Negative when a ranks first
 */
const compareTriggers = (a: ReopenTrigger, b: ReopenTrigger): number =>
  Number(b.reason === 'kev_listed') - Number(a.reason === 'kev_listed') ||
  compareSeverity(a.severity, b.severity) ||
  a.imageRef.localeCompare(b.imageRef)

/**
 * Finds why a decision must re-open: a governed open finding that is KEV listed now but was not
 * at its baseline, or whose severity now ranks above its baseline. Findings without a baseline
 * are covered at their current state, the next sync records it.
 * @param {readonly DecisionBaseline[]} baselines - Baselines of the decision
 * @param {readonly BaselineSubject[]} findings - Open findings the decision governs
 * @returns {ReopenTrigger | null} - Highest ranked trigger, null when every finding is at or below its baseline
 */
export const findReopenTrigger = (
  baselines: readonly DecisionBaseline[],
  findings: readonly BaselineSubject[],
): ReopenTrigger | null => {
  const byImage = new Map(baselines.map((baseline) => [baseline.imageRef, baseline]))
  const triggers = findings.flatMap((finding): ReopenTrigger[] => {
    const baseline = byImage.get(finding.imageRef)

    if (!baseline) {
      return []
    }

    const detail = {
      imageRef: finding.imageRef,
      severity: finding.severity,
      kev: finding.kev,
      baselineSeverity: baseline.severity,
      baselineKev: baseline.kev,
    }

    if (finding.kev && !baseline.kev) {
      return [{ reason: 'kev_listed', ...detail }]
    }

    if (isSeverityHigher(finding.severity, baseline.severity)) {
      return [{ reason: 'severity_rose', ...detail }]
    }

    return []
  })

  return triggers.sort(compareTriggers)[0] ?? null
}
