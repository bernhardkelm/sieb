export const SEVERITIES = ['Critical', 'High', 'Medium', 'Low', 'Unknown'] as const

export type Severity = (typeof SEVERITIES)[number]

/**
 * Returns the rank of a severity, higher is more severe.
 * @param {Severity} severity - Severity
 * @returns {number} - 4 for Critical down to 0 for Unknown
 */
export const severityRank = (severity: Severity): number =>
  SEVERITIES.length - 1 - SEVERITIES.indexOf(severity)

/**
 * Returns whether a severity ranks strictly higher than another one.
 * @param {Severity} severity - Severity to test
 * @param {Severity} than - Severity compared against
 * @returns {boolean} - True when severity is more severe than `than`
 */
export const isSeverityHigher = (severity: Severity, than: Severity): boolean =>
  severityRank(severity) > severityRank(than)

/**
 * Compares two severities for a sort with the most severe first.
 * @param {Severity} a - First severity
 * @param {Severity} b - Second severity
 * @returns {number} - Negative when a sorts before b
 */
export const compareSeverity = (a: Severity, b: Severity): number =>
  severityRank(b) - severityRank(a)

/**
 * Returns the most severe of several severities.
 * @param {readonly Severity[]} severities - Severities
 * @returns {Severity} - Most severe one, Unknown for an empty list
 */
export const maxSeverity = (severities: readonly Severity[]): Severity =>
  severities.reduce<Severity>(
    (max, severity) => (isSeverityHigher(severity, max) ? severity : max),
    'Unknown',
  )

/**
 * Parses a severity label case-insensitively, as Prometheus (title case) and Trivy (upper case)
 * spell it.
 * @param {string | null | undefined} value - Raw label
 * @returns {Severity} - Matching severity, Unknown for missing or unrecognised values
 */
export const parseSeverity = (value: string | null | undefined): Severity => {
  const normalized = value?.trim().toLowerCase()

  return SEVERITIES.find((severity) => severity.toLowerCase() === normalized) ?? 'Unknown'
}

/**
 * Derives a severity from a CVSS base score using the CVSS v3 rating bands.
 * @param {number | null | undefined} score - CVSS score from 0 to 10
 * @returns {Severity} - Banded severity, Unknown for a missing or zero score
 */
export const severityFromScore = (score: number | null | undefined): Severity => {
  if (score === null || score === undefined || !Number.isFinite(score) || score <= 0) {
    return 'Unknown'
  }

  if (score >= 9) {
    return 'Critical'
  }

  if (score >= 7) {
    return 'High'
  }

  if (score >= 4) {
    return 'Medium'
  }

  return 'Low'
}
