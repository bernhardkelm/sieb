import type { DatabaseSync } from 'node:sqlite'

import { countDecisionStates } from '#core/decisionStates.ts'
import type { MetricsInput } from '#core/metricsText.ts'
import { collectSuppressions } from '#core/suppressions.ts'
import { resolveTriage } from '#core/triage.ts'
import { listDecisions } from '#server/db/decisionRepository.ts'
import { listFindingSummaries } from '#server/db/findingRepository.ts'
import { latestSyncRun } from '#server/db/syncRunRepository.ts'

/**
 * Reads what /metrics exposes: the suppressed open findings evaluated now, the latest finished
 * sync, the open finding count and the decisions per state. Render it with renderMetrics.
 * @param {DatabaseSync} db - Open database
 * @param {Date} now - Current time
 * @returns {MetricsInput} - Metric values
 */
export const readMetricsInput = (db: DatabaseSync, now: Date): MetricsInput => {
  const findings = listFindingSummaries(db)
  const triage = resolveTriage(findings, listDecisions(db), now)
  const lastRun = latestSyncRun(db, { finished: true })

  return {
    suppressions: collectSuppressions(findings, triage),
    lastSync: lastRun?.finishedAt
      ? { finishedAt: lastRun.finishedAt, ok: lastRun.status === 'success' }
      : null,
    findingsOpen: findings.filter((finding) => finding.resolvedAt === null).length,
    decisionStates: countDecisionStates(triage.byDecision.values()),
  }
}
