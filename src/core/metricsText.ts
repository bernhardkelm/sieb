import { DECISION_STATES } from '#core/decisionStates.ts'
import type { DecisionState } from '#core/effectiveDecision.ts'
import type { Suppression } from '#core/suppressions.ts'

export interface MetricsInput {
  suppressions: Suppression[]
  lastSync: { finishedAt: string; ok: boolean } | null // latest finished sync run
  findingsOpen: number
  decisionStates: Record<DecisionState, number>
}

export const METRICS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8'

/**
 * Escapes a label value for the Prometheus text format: backslash, double quote and newline.
 * @param {string} value - Raw label value
 * @returns {string} - Escaped value without surrounding quotes
 */
export const escapeLabelValue = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')

/**
 * Renders the HELP and TYPE lines of a gauge.
 * @param {string} name - Metric name
 * @param {string} help - Help text without backslashes or newlines
 * @returns {string[]} - Two comment lines
 */
const gaugeHeader = (name: string, help: string): string[] => [
  `# HELP ${name} ${help}`,
  `# TYPE ${name} gauge`,
]

/**
 * Renders one sample line.
 * @param {string} name - Metric name
 * @param {Record<string, string>} labels - Label names and raw values
 * @param {number} value - Sample value
 * @returns {string} - Sample line
 */
const sample = (name: string, labels: Record<string, string>, value: number): string => {
  const pairs = Object.entries(labels).map(([key, raw]) => `${key}="${escapeLabelValue(raw)}"`)

  return `${name}${pairs.length > 0 ? `{${pairs.join(',')}}` : ''} ${value}`
}

/**
 * Renders the sieb metrics in the Prometheus text exposition format: one series per open
 * finding silenced by its governing decision, the last sync time and outcome, the open findings
 * and the decisions per state. The sync timestamp is omitted before the first finished sync, its
 * success is 0 then.
 * @param {MetricsInput} input - Values to expose
 * @returns {string} - Exposition text ending with a newline
 */
export const renderMetrics = ({
  suppressions,
  lastSync,
  findingsOpen,
  decisionStates,
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
  ]

  return `${lines.join('\n')}\n`
}
