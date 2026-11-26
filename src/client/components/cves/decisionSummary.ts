import type { FindingView } from '#core/findingView.ts'
import { STATE_LABELS, STATUS_LABELS } from '@/format/labels'

type SummaryFinding = Pick<FindingView, 'decision' | 'effective' | 'resolvedAt'>

const UNDECIDED = 'undecided'

const ORDER = [
  STATUS_LABELS.accepted,
  STATUS_LABELS.not_affected,
  STATUS_LABELS.fix_planned,
  STATE_LABELS.reopened,
  STATE_LABELS.expired,
  UNDECIDED,
].map((label) => label.toLowerCase())

/**
 * Returns the summary category of a finding: the status of an active decision, the state of a
 * lapsed one, or undecided.
 * @param {SummaryFinding} finding - Finding with its governing decision
 * @returns {string} - Lower-case category label
 */
const categoryOf = (finding: SummaryFinding): string => {
  const state = finding.effective?.state

  if (!finding.decision || state === undefined || state === 'revoked') {
    return UNDECIDED
  }

  return (
    state === 'active' ? STATUS_LABELS[finding.decision.status] : STATE_LABELS[state]
  ).toLowerCase()
}

/**
 * Summarises how the open findings of a CVE are decided.
 * @param {readonly SummaryFinding[]} findings - Findings of one CVE
 * @returns {string} - Such as "3 accepted, 1 undecided", empty without open findings
 */
export const summarizeDecisions = (findings: readonly SummaryFinding[]): string => {
  const counts = new Map<string, number>()

  for (const finding of findings) {
    if (finding.resolvedAt === null) {
      const category = categoryOf(finding)

      counts.set(category, (counts.get(category) ?? 0) + 1)
    }
  }

  return ORDER.filter((category) => counts.has(category))
    .map((category) => `${counts.get(category)} ${category}`)
    .join(', ')
}
