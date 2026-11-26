import { SEVERITIES, type Severity } from '#core/severity.ts'

export interface SeverityCount {
  severity: Severity
  count: number
}

/**
 * Lists the open findings per severity, every severity present from critical to unknown.
 * @param {Record<Severity, number>} bySeverity - Open findings per severity
 * @returns {SeverityCount[]} - Counts in severity order
 */
export const severityBreakdown = (bySeverity: Record<Severity, number>): SeverityCount[] =>
  SEVERITIES.map((severity) => ({ severity, count: bySeverity[severity] ?? 0 }))

/**
 * Describes a severity breakdown in words, leaving out severities without findings.
 * @param {readonly SeverityCount[]} counts - Counts in severity order
 * @returns {string} - Such as "2 critical, 5 high", or "No open findings"
 */
export const describeSeverityBreakdown = (counts: readonly SeverityCount[]): string =>
  counts
    .filter(({ count }) => count > 0)
    .map(({ severity, count }) => `${count} ${severity.toLowerCase()}`)
    .join(', ') || 'No open findings'
