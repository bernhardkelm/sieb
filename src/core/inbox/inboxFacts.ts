import { maxExposure } from '#core/exposure.ts'
import type { InboxFinding, InboxItemLabels } from '#core/inbox/inboxItem.ts'
import { compareSeverity, maxSeverity, type Severity } from '#core/severity.ts'
import { DAY_MS } from '#core/timeUnits.ts'

/** Row facts an item derives from the open findings it covers */
export interface CoveredFacts extends InboxItemLabels {
  severity: Severity
  kev: boolean
  title: string | null
  lead: InboxFinding | null // finding the row links to
}

/**
 * Returns whether a time lies at most a number of days before now. Later times count as inside.
 * @param {string} at - ISO time
 * @param {Date} now - Current time
 * @param {number} days - Window in days
 * @returns {boolean} - True inside the window, boundary included
 */
export const withinDaysBefore = (at: string, now: Date, days: number): boolean =>
  now.getTime() - Date.parse(at) <= days * DAY_MS

/**
 * Orders covered findings for the lead: a preferred image first, then KEV listed, then the most
 * severe, then the lowest id.
 * @param {string | null} preferredImage - Image to lead with, null for none
 * @returns {(a: InboxFinding, b: InboxFinding) => number} - Comparator
 */
const leadOrder =
  (preferredImage: string | null) =>
  (a: InboxFinding, b: InboxFinding): number =>
    Number(b.imageRef === preferredImage) - Number(a.imageRef === preferredImage) ||
    Number(b.kev) - Number(a.kev) ||
    compareSeverity(a.severity, b.severity) ||
    a.id - b.id

/**
 * Returns the distinct values of several lists, sorted.
 * @param {readonly (readonly string[])[]} lists - Lists
 * @returns {string[]} - Distinct values
 */
const distinct = (lists: readonly (readonly string[])[]): string[] =>
  [...new Set(lists.flat())].sort()

/**
 * Collects the labels of the open findings an item covers.
 * @param {readonly InboxFinding[]} findings - Covered open findings
 * @returns {InboxItemLabels} - Most exposed exposure, owners, packages and namespaces
 */
export const coveredLabels = (findings: readonly InboxFinding[]): InboxItemLabels => ({
  exposure: findings.length === 0 ? null : maxExposure(findings.map((finding) => finding.exposure)),
  owners: distinct(findings.map((finding) => (finding.owner === null ? [] : [finding.owner]))),
  packages: distinct(findings.map((finding) => finding.packages)),
  namespaces: distinct(findings.map((finding) => finding.namespaces)),
})

/**
 * Summarises the open findings an item covers for its row.
 * @param {readonly InboxFinding[]} findings - Covered open findings
 * @param {{ severity: Severity; kev: boolean }} fallback - Facts when no open finding is covered
 * @param {string | null} preferredImage - Image whose finding leads, null for none
 * @returns {CoveredFacts} - Highest severity, any KEV, a title, the lead finding and the labels
 */
export const coveredFacts = (
  findings: readonly InboxFinding[],
  fallback: { severity: Severity; kev: boolean },
  preferredImage: string | null = null,
): CoveredFacts => {
  if (findings.length === 0) {
    return { ...fallback, title: null, lead: null, ...coveredLabels([]) }
  }

  const ordered = [...findings].sort(leadOrder(preferredImage))

  return {
    severity: maxSeverity(findings.map((finding) => finding.severity)),
    kev: findings.some((finding) => finding.kev),
    title: ordered.find((finding) => finding.title !== null)?.title ?? null,
    lead: ordered[0] ?? null,
    ...coveredLabels(findings),
  }
}
