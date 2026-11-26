import type { Decision } from '#core/decision.ts'
import { evaluateDecision, type EffectiveDecision } from '#core/effectiveDecision.ts'
import { findingDecisionState, type FindingDecisionState } from '#core/findingDecisionState.ts'
import type { FindingView } from '#core/findingView.ts'
import { groupBy } from '#core/groupBy.ts'
import { compareInbox } from '#core/inbox.ts'
import { maxExposure, type Exposure } from '#core/exposure.ts'
import { maxSeverity, type Severity } from '#core/severity.ts'

const FINDING_DECISION_STATES = [
  'undecided',
  'active',
  'fix_planned',
  'expired',
  'reopened',
  'revoked',
] as const satisfies readonly FindingDecisionState[]

/** Findings of one vuln_id across images */
export interface CveAggregate {
  vulnId: string
  title: string | null
  primaryLink: string | null
  kev: boolean
  maxSeverity: Severity
  maxScore: number | null
  maxExposure: Exposure | null // null when the most exposed finding has no exposure label
  imageCount: number
  imageRefs: string[] // sorted
  openCount: number
  inboxCount: number
  decisionStates: Record<FindingDecisionState, number> // open findings by governing decision
  allScopeDecision: Decision | null // the non-revoked all-scope decision of the vuln_id
  allScopeEffective: EffectiveDecision | null // its state, a pending re-open included
}

/**
 * Evaluates the all-scope decision of a CVE like the triage does: the state a finding it governs
 * carries, otherwise against no open finding, since every open finding is part of the list.
 * @param {Decision} decision - All-scope decision
 * @param {readonly FindingView[]} findings - Findings of its vuln_id with their governing decision
 * @param {Date} now - Current time
 * @returns {EffectiveDecision} - State of the decision
 */
const allScopeEffectiveOf = (
  decision: Decision,
  findings: readonly FindingView[],
  now: Date,
): EffectiveDecision =>
  findings.find((finding) => finding.decision?.id === decision.id)?.effective ??
  evaluateDecision(decision, [], now)

/**
 * Aggregates the findings of one vulnerability.
 * @param {string} vulnId - Vulnerability id
 * @param {readonly FindingView[]} findings - Its findings, at least one
 * @param {readonly Decision[]} decisions - Decisions of any vuln_id
 * @param {Date} now - Current time
 * @returns {CveAggregate} - Aggregate
 */
const aggregateCve = (
  vulnId: string,
  findings: readonly FindingView[],
  decisions: readonly Decision[],
  now: Date,
): CveAggregate => {
  const open = findings.filter((finding) => finding.resolvedAt === null)
  const scores = findings.flatMap((finding) => (finding.score === null ? [] : [finding.score]))
  const imageRefs = [...new Set(findings.map((finding) => finding.imageRef))].sort()
  const decisionStates = Object.fromEntries(
    FINDING_DECISION_STATES.map((state) => [state, 0]),
  ) as Record<FindingDecisionState, number>

  for (const finding of open) {
    decisionStates[findingDecisionState(finding)] += 1
  }

  const allScopeDecision =
    decisions.find(
      (decision) =>
        decision.vulnId === vulnId && decision.scope === 'all' && decision.revokedAt === null,
    ) ?? null

  return {
    vulnId,
    title: findings.find((finding) => finding.title !== null)?.title ?? null,
    primaryLink: findings.find((finding) => finding.primaryLink !== null)?.primaryLink ?? null,
    kev: findings.some((finding) => finding.kev),
    maxSeverity: maxSeverity(findings.map((finding) => finding.severity)),
    maxScore: scores.length > 0 ? Math.max(...scores) : null,
    maxExposure: maxExposure(findings.map((finding) => finding.exposure)),
    imageCount: imageRefs.length,
    imageRefs,
    openCount: open.length,
    inboxCount: findings.filter((finding) => finding.inInbox).length,
    decisionStates,
    allScopeDecision,
    allScopeEffective:
      allScopeDecision === null ? null : allScopeEffectiveOf(allScopeDecision, findings, now),
  }
}

/**
 * Returns whether every open finding of a CVE carries a decision in effect: active not_affected
 * or accepted, or fix_planned. Expired, revoked and re-opened decisions do not count, and a CVE
 * without open findings is never fully decided.
 * @param {Pick<CveAggregate, 'openCount' | 'decisionStates'>} cve - CVE aggregate
 * @returns {boolean} - True when no open finding of the CVE needs triage
 */
export const isFullyDecided = (cve: Pick<CveAggregate, 'openCount' | 'decisionStates'>): boolean =>
  cve.openCount > 0 && cve.decisionStates.active + cve.decisionStates.fix_planned === cve.openCount

/**
 * Aggregates findings per vuln_id, sorted like the inbox: KEV, exposure, severity, score, id.
 * @param {readonly FindingView[]} findings - Findings with their governing decision
 * @param {readonly Decision[]} decisions - Decisions, used for the all-scope decision of each CVE
 * @param {Date} now - Current time, evaluates an all-scope decision without governed findings
 * @returns {CveAggregate[]} - One aggregate per vuln_id
 */
export const aggregateCves = (
  findings: readonly FindingView[],
  decisions: readonly Decision[],
  now: Date,
): CveAggregate[] =>
  [...groupBy(findings, (finding) => finding.vulnId)]
    .map(([vulnId, group]) => aggregateCve(vulnId, group, decisions, now))
    .sort((a, b) =>
      compareInbox(
        { ...a, exposure: a.maxExposure, severity: a.maxSeverity, score: a.maxScore, imageRef: '' },
        { ...b, exposure: b.maxExposure, severity: b.maxSeverity, score: b.maxScore, imageRef: '' },
      ),
    )
