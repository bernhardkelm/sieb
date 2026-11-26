import type { Decision } from '#core/decision.ts'
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
}

/**
 * Aggregates the findings of one vulnerability.
 * @param {string} vulnId - Vulnerability id
 * @param {readonly FindingView[]} findings - Its findings, at least one
 * @param {readonly Decision[]} decisions - Decisions of any vuln_id
 * @returns {CveAggregate} - Aggregate
 */
const aggregateCve = (
  vulnId: string,
  findings: readonly FindingView[],
  decisions: readonly Decision[],
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
    allScopeDecision:
      decisions.find(
        (decision) =>
          decision.vulnId === vulnId && decision.scope === 'all' && decision.revokedAt === null,
      ) ?? null,
  }
}

/**
 * Aggregates findings per vuln_id, sorted like the inbox: KEV, exposure, severity, score, id.
 * @param {readonly FindingView[]} findings - Findings with their governing decision
 * @param {readonly Decision[]} decisions - Decisions, used for the all-scope decision of each CVE
 * @returns {CveAggregate[]} - One aggregate per vuln_id
 */
export const aggregateCves = (
  findings: readonly FindingView[],
  decisions: readonly Decision[] = [],
): CveAggregate[] =>
  [...groupBy(findings, (finding) => finding.vulnId)]
    .map(([vulnId, group]) => aggregateCve(vulnId, group, decisions))
    .sort((a, b) =>
      compareInbox(
        { ...a, exposure: a.maxExposure, severity: a.maxSeverity, score: a.maxScore, imageRef: '' },
        { ...b, exposure: b.maxExposure, severity: b.maxSeverity, score: b.maxScore, imageRef: '' },
      ),
    )
