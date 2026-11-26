import type { DatabaseSync } from 'node:sqlite'

import type { Decision } from '#core/decision.ts'
import { governedFindings } from '#core/decisionApplicability.ts'
import type { Finding } from '#core/finding.ts'
import { maxSeverity } from '#core/severity.ts'
import { replaceBaselines } from '#server/db/decisionBaselineRepository.ts'
import { listDecisionsByVuln } from '#server/db/decisionRepository.ts'
import { listFindingsByVuln } from '#server/db/findingRepository.ts'

/**
 * Prefers the open findings of a list, falls back to all of them when none is open.
 * @param {readonly Finding[]} findings - Findings
 * @returns {readonly Finding[]} - Open findings, or all
 */
const openOrAll = (findings: readonly Finding[]): readonly Finding[] => {
  const open = findings.filter((finding) => finding.resolvedAt === null)

  return open.length > 0 ? open : findings
}

/**
 * Records what a new or re-confirmed decision was decided at: one baseline per governed image
 * from its current severity and KEV listing, resolved findings included so a reappearance is
 * compared too, and the display summary severity_at_decision and kev_at_decision over the open
 * governed findings. Without a governed finding the summary covers every finding of the vuln_id.
 * @param {DatabaseSync} db - Open database, inside the command transaction
 * @param {Pick<Decision, 'id' | 'vulnId'>} decision - Stored decision
 * @param {string} at - ISO time recorded on the baselines
 * @returns {void}
 */
export const recordDecisionSnapshot = (
  db: DatabaseSync,
  decision: Pick<Decision, 'id' | 'vulnId'>,
  at: string,
): void => {
  const findings = listFindingsByVuln(db, decision.vulnId)
  const decisions = listDecisionsByVuln(db, decision.vulnId)
  const governed = governedFindings(decision.id, decisions, findings)
  const basis = openOrAll(governed.length > 0 ? governed : findings)

  replaceBaselines(
    db,
    decision.id,
    governed.map((finding) => ({
      imageRef: finding.imageRef,
      severity: finding.severity,
      kev: finding.kev,
      recordedAt: at,
    })),
  )
  db.prepare('UPDATE decisions SET severity_at_decision = ?, kev_at_decision = ? WHERE id = ?').run(
    maxSeverity(basis.map((finding) => finding.severity)),
    basis.some((finding) => finding.kev) ? 1 : 0,
    decision.id,
  )
}
