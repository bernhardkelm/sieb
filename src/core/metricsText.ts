import { renderCheckMetrics, type CheckMetrics } from '#core/checkMetricsText.ts'
import { DECISION_STATES } from '#core/decisionStates.ts'
import type { DecisionState } from '#core/effectiveDecision.ts'
import { metricHeader, sample } from '#core/metricsFormat.ts'
import type { Suppression } from '#core/suppressions.ts'

export interface MetricsInput {
  suppressions: Suppression[]
  lastSync: { finishedAt: string; ok: boolean } | null // latest finished sync run
  findingsOpen: number
  decisionStates: Record<DecisionState, number>
  checks: CheckMetrics
}

export const METRICS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8'

/**
 * Renders the HELP and TYPE lines of a gauge.
 * @param {string} name - Metric name
 * @param {string} help - Help text without backslashes or newlines
 * @returns {string[]} - Two comment lines
 */
const gaugeHeader = (name: string, help: string): string[] => metricHeader(name, 'gauge', help)

/**
 * Renders the sieb metrics in the Prometheus text exposition format: one series per open
 * finding silenced by its governing decision, the last sync time and outcome, the open findings,
 * the decisions per state and the Auto-check queue. The sync timestamp is omitted before the
 * first finished sync, its success is 0 then.
 * @param {MetricsInput} input - Values to expose
 * @returns {string} - Exposition text ending with a newline
 */
export const renderMetrics = ({
  suppressions,
  lastSync,
  findingsOpen,
  decisionStates,
  checks,
}: MetricsInput): string => {
  const lines = [
    ...gaugeHeader(
      'sieb_suppressed',
      'Effective triage decision silencing alerts of vuln_id in image_ref.',
    ),
    ...suppressions.map(({ vulnId, imageRef }) =>
      sample('sieb_suppressed', { vuln_id: vulnId, image_ref: imageRef }, 1),
    ),
    ...gaugeHeader(
      'sieb_last_sync_timestamp_seconds',
      'Unix time the latest finished sync ended, successful or not.',
    ),
    ...(lastSync
      ? [sample('sieb_last_sync_timestamp_seconds', {}, Date.parse(lastSync.finishedAt) / 1000)]
      : []),
    ...gaugeHeader('sieb_last_sync_success', 'Whether the latest finished sync succeeded.'),
    sample('sieb_last_sync_success', {}, lastSync?.ok ? 1 : 0),
    ...gaugeHeader('sieb_findings_open', 'Findings not resolved by the latest successful sync.'),
    sample('sieb_findings_open', {}, findingsOpen),
    ...gaugeHeader('sieb_decisions', 'Triage decisions by their current state.'),
    ...DECISION_STATES.map((state) => sample('sieb_decisions', { state }, decisionStates[state])),
    ...renderCheckMetrics(checks),
  ]

  return `${lines.join('\n')}\n`
}
