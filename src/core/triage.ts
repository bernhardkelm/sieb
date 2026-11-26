import type { Decision } from '#core/decision.ts'
import { selectApplicableDecision } from '#core/decisionApplicability.ts'
import { evaluateDecision, type EffectiveDecision } from '#core/effectiveDecision.ts'
import type { Finding } from '#core/finding.ts'
import { findReopenTrigger, type ReopenTrigger } from '#core/reopenTrigger.ts'

export type TriageFinding = Pick<
  Finding,
  'id' | 'vulnId' | 'imageRef' | 'severity' | 'kev' | 'resolvedAt'
>

export interface DecisionTriage {
  decision: Decision
  effective: EffectiveDecision
  openFindings: TriageFinding[] // open findings the decision governs
  liveTrigger: ReopenTrigger | null // re-open condition of the current data, ignoring expiry and latching
}

export interface FindingTriage {
  decision: Decision
  effective: EffectiveDecision
}

export interface Triage {
  byDecision: Map<number, DecisionTriage>
  byFinding: Map<number, FindingTriage> // findings without a governing decision are absent
}

/**
 * Resolves which decision governs each finding and evaluates every decision against the open
 * findings it governs, each compared with its own baseline, so an all-scope decision re-opens
 * for all its images when one of them rises. Findings of other vuln_ids never influence each
 * other, so a subset of findings and decisions sharing one vuln_id yields the same result as the
 * full set.
 * @param {readonly TriageFinding[]} findings - Findings
 * @param {readonly Decision[]} decisions - Decisions, revoked ones included
 * @param {Date} now - Current time
 * @returns {Triage} - Per decision and per finding view
 */
export const resolveTriage = (
  findings: readonly TriageFinding[],
  decisions: readonly Decision[],
  now: Date,
): Triage => {
  const byVuln = new Map<string, Decision[]>()

  for (const decision of decisions) {
    byVuln.set(decision.vulnId, [...(byVuln.get(decision.vulnId) ?? []), decision])
  }

  const governing = new Map<number, Decision>()
  const governed = new Map<number, TriageFinding[]>()

  for (const finding of findings) {
    const decision = selectApplicableDecision(byVuln.get(finding.vulnId) ?? [], finding)

    if (decision === null) {
      continue
    }

    governing.set(finding.id, decision)

    if (finding.resolvedAt === null) {
      governed.set(decision.id, [...(governed.get(decision.id) ?? []), finding])
    }
  }

  const byDecision = new Map<number, DecisionTriage>()

  for (const decision of decisions) {
    const openFindings = governed.get(decision.id) ?? []

    byDecision.set(decision.id, {
      decision,
      effective: evaluateDecision(decision, openFindings, now),
      openFindings,
      liveTrigger: findReopenTrigger(decision.baselines, openFindings),
    })
  }

  const byFinding = new Map<number, FindingTriage>()

  for (const [findingId, decision] of governing) {
    const triage = byDecision.get(decision.id)

    if (triage) {
      byFinding.set(findingId, { decision, effective: triage.effective })
    }
  }

  return { byDecision, byFinding }
}
