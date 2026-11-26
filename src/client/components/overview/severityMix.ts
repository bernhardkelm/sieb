import type { SeverityCounts } from '#core/overviewStats.ts'
import { formatCount } from '@/format/count'

export type SeverityKey = keyof SeverityCounts

export interface SeveritySegment {
  key: SeverityKey
  label: string
  count: number
  share: number // 0 to 1 of all open findings
  shareLabel: string // such as "12%" or "<1%"
}

const ORDER: { key: SeverityKey; label: string }[] = [
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
  { key: 'unknown', label: 'Unknown' },
]

/**
 * Returns the colour token of a severity.
 * @param {SeverityKey} key - Severity
 * @returns {string} - CSS var() reference
 */
export const severityColor = (key: SeverityKey): string => `var(--color-severity-${key})`

/**
 * Formats a share as a whole percentage, a non-zero share below one percent as "<1%".
 * @param {number} share - Share from 0 to 1
 * @returns {string} - Percentage
 */
export const formatShare = (share: number): string => {
  if (share > 0 && share < 0.01) {
    return '<1%'
  }

  return `${Math.round(share * 100)}%`
}

/**
 * Splits the open findings into segments from critical to unknown, severities without findings
 * left out.
 * @param {SeverityCounts} counts - Open findings per severity
 * @returns {SeveritySegment[]} - Segments in severity order, empty without findings
 */
export const severitySegments = (counts: SeverityCounts): SeveritySegment[] => {
  const total = ORDER.reduce((sum, { key }) => sum + counts[key], 0)

  if (total === 0) {
    return []
  }

  return ORDER.filter(({ key }) => counts[key] > 0).map(({ key, label }) => {
    const share = counts[key] / total

    return { key, label, count: counts[key], share, shareLabel: formatShare(share) }
  })
}

/**
 * Describes the severity mix in words.
 * @param {readonly SeveritySegment[]} segments - Segments of the mix
 * @returns {string} - Such as "Critical 12 (1%), High 140 (11%)", or "No open findings"
 */
export const describeSeverityMix = (segments: readonly SeveritySegment[]): string =>
  segments
    .map(({ label, count, shareLabel }) => `${label} ${formatCount(count)} (${shareLabel})`)
    .join(', ') || 'No open findings'
