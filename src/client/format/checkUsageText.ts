import type { CheckUsageSummary, CheckUsageWindow } from '#core/check.ts'
import { costText } from '@/format/checkResultText'
import { formatElapsed } from '@/format/checkText'
import { formatCount } from '@/format/count'

export interface CheckUsageRow {
  label: string
  /** Values of the 7 and 30 day windows */
  values: [string, string]
}

const FIELDS: { label: string; value: (window: CheckUsageWindow) => string }[] = [
  { label: 'Checks', value: (window) => formatCount(window.checks) },
  { label: 'Input tokens', value: (window) => formatCount(window.inputTokens) },
  { label: 'Output tokens', value: (window) => formatCount(window.outputTokens) },
  { label: 'Cache tokens', value: (window) => formatCount(window.cacheTokens) },
  {
    label: 'Cost, API-equivalent estimate',
    value: (window) => costText(window.costUsd) ?? 'not reported',
  },
  {
    label: 'Average duration',
    value: (window) =>
      window.averageDurationMs === null ? 'none' : formatElapsed(window.averageDurationMs),
  },
]

/**
 * Lays out the usage summary as rows of a table with one column per window.
 * @param {CheckUsageSummary} summary - Usage of the last 7 and 30 days
 * @returns {CheckUsageRow[]} - Label and both values per row
 */
export const checkUsageRows = (summary: CheckUsageSummary): CheckUsageRow[] =>
  FIELDS.map(({ label, value }) => ({
    label,
    values: [value(summary.last7Days), value(summary.last30Days)],
  }))
