import type { Decision } from '#core/decision.ts'
import { countDecisionStates } from '#core/decisionStates.ts'
import { isSuppressing } from '#core/effectiveDecision.ts'
import type { Finding } from '#core/finding.ts'
import { isInInbox } from '#core/inbox.ts'
import type { Severity } from '#core/severity.ts'
import { resolveTriage, type TriageFinding } from '#core/triage.ts'

export interface SeverityCounts {
  critical: number
  high: number
  medium: number
  low: number
  unknown: number
}

/** Overview counts at one point in time, finding counts over open findings (vuln_id x image_ref) */
export interface OverviewStats {
  open: number
  inbox: number // open findings without an active or fix_planned decision
  kev: number
  public: number // open findings whose max exposure is public
  bySeverity: SeverityCounts
  suppressed: number // open findings whose governing decision silences alerts
  fixPlanned: number // decisions in state fix_planned
  reopened: number // decisions in state reopened
  activeDecisions: number // decisions in state active
  images: number // distinct image_refs with an open finding
}

/** Overview counts recorded at a time */
export interface StatsPoint {
  at: string
  stats: OverviewStats
}

export type StatsFinding = TriageFinding & Pick<Finding, 'exposure'>

const SEVERITY_KEYS: Record<Severity, keyof SeverityCounts> = {
  Critical: 'critical',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
  Unknown: 'unknown',
}

/**
 * Returns overview counts that are all zero.
 * @returns {OverviewStats} - Zero counts
 */
export const emptyOverviewStats = (): OverviewStats => ({
  open: 0,
  inbox: 0,
  kev: 0,
  public: 0,
  bySeverity: { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 },
  suppressed: 0,
  fixPlanned: 0,
  reopened: 0,
  activeDecisions: 0,
  images: 0,
})

/**
 * Computes the overview counts. Resolved findings are ignored, they influence neither the
 * finding counts nor any decision state.
 * @param {readonly StatsFinding[]} findings - Findings, resolved ones may be included
 * @param {readonly Decision[]} decisions - Decisions, revoked ones included
 * @param {Date} now - Current time
 * @returns {OverviewStats} - Counts
 */
export const computeOverviewStats = (
  findings: readonly StatsFinding[],
  decisions: readonly Decision[],
  now: Date,
): OverviewStats => {
  const open = findings.filter((finding) => finding.resolvedAt === null)
  const triage = resolveTriage(open, decisions, now)
  const states = countDecisionStates(triage.byDecision.values())
  const stats = emptyOverviewStats()

  for (const finding of open) {
    const effective = triage.byFinding.get(finding.id)?.effective ?? null

    stats.open += 1
    stats.inbox += isInInbox(finding, effective) ? 1 : 0
    stats.kev += finding.kev ? 1 : 0
    stats.public += finding.exposure === 'public' ? 1 : 0
    stats.suppressed += effective !== null && isSuppressing(effective) ? 1 : 0
    stats.bySeverity[SEVERITY_KEYS[finding.severity]] += 1
  }

  stats.images = new Set(open.map((finding) => finding.imageRef)).size
  stats.fixPlanned = states.fix_planned
  stats.reopened = states.reopened
  stats.activeDecisions = states.active

  return stats
}
