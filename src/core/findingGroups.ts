import type { FindingView } from '#core/findingView.ts'
import { compareSeverity, maxSeverity, type Severity } from '#core/severity.ts'

export const FINDING_GROUP_KEYS = ['cve', 'image', 'namespace', 'package'] as const

export type FindingGroupKey = (typeof FINDING_GROUP_KEYS)[number]

/** Counts over the findings sharing one CVE, image, namespace or package */
export interface FindingGroup {
  key: string
  count: number // findings, vuln_id x image_ref
  maxSeverity: Severity
  kevCount: number
  inboxCount: number
  imageCount: number // distinct image_refs
  vulnCount: number // distinct vuln_ids
}

type GroupableFinding = Pick<
  FindingView,
  'vulnId' | 'imageRef' | 'namespaces' | 'packages' | 'severity' | 'kev' | 'inInbox'
>

const UNKNOWN_KEY = '(unknown)'

/**
 * Returns the group keys of a finding. A finding in several namespaces or with several
 * packages counts in each of their groups, one without any in the unknown group.
 * @param {GroupableFinding} finding - Finding
 * @param {FindingGroupKey} by - Grouping
 * @returns {string[]} - Keys
 */
const groupKeys = (finding: GroupableFinding, by: FindingGroupKey): string[] => {
  if (by === 'cve') {
    return [finding.vulnId]
  }

  if (by === 'image') {
    return [finding.imageRef]
  }

  const names = by === 'namespace' ? finding.namespaces : finding.packages

  return names.length > 0 ? names : [UNKNOWN_KEY]
}

/**
 * Builds the counts of one group.
 * @param {string} key - Group key
 * @param {readonly GroupableFinding[]} findings - Findings of the group
 * @returns {FindingGroup} - Group
 */
const toGroup = (key: string, findings: readonly GroupableFinding[]): FindingGroup => ({
  key,
  count: findings.length,
  maxSeverity: maxSeverity(findings.map((finding) => finding.severity)),
  kevCount: findings.filter((finding) => finding.kev).length,
  inboxCount: findings.filter((finding) => finding.inInbox).length,
  imageCount: new Set(findings.map((finding) => finding.imageRef)).size,
  vulnCount: new Set(findings.map((finding) => finding.vulnId)).size,
})

/**
 * Groups findings by CVE, image, namespace or package, most severe group first, then by count
 * and key.
 * @param {readonly GroupableFinding[]} findings - Findings, already filtered
 * @param {FindingGroupKey} by - Grouping
 * @returns {FindingGroup[]} - Groups
 */
export const groupFindings = (
  findings: readonly GroupableFinding[],
  by: FindingGroupKey,
): FindingGroup[] => {
  const groups = new Map<string, GroupableFinding[]>()

  for (const finding of findings) {
    for (const key of groupKeys(finding, by)) {
      const group = groups.get(key)

      if (group) {
        group.push(finding)
      } else {
        groups.set(key, [finding])
      }
    }
  }

  return [...groups]
    .map(([key, group]) => toGroup(key, group))
    .sort(
      (a, b) =>
        compareSeverity(a.maxSeverity, b.maxSeverity) ||
        b.count - a.count ||
        a.key.localeCompare(b.key),
    )
}
