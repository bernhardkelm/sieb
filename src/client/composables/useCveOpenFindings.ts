import { computed, type ComputedRef } from 'vue'

import type { FindingView } from '#core/findingView.ts'
import { groupBy } from '#core/groupBy.ts'
import { summarizeDecisions } from '@/components/cves/decisionSummary'
import { useFindingsStore } from '@/stores/findingsStore'

export interface CveOpenFindings {
  /** Open findings per vuln id */
  openByCve: ComputedRef<Map<string, FindingView[]>>
  /** Decision summary of the open findings per vuln id */
  summaries: ComputedRef<Map<string, string>>
}

/**
 * Groups the open findings of the findings store by CVE and summarizes their decisions.
 * @returns {CveOpenFindings} - Open findings and decision summaries per vuln id
 */
export const useCveOpenFindings = (): CveOpenFindings => {
  const findings = useFindingsStore()

  const openByCve = computed(() =>
    groupBy(
      findings.items.filter((finding) => finding.resolvedAt === null),
      (finding) => finding.vulnId,
    ),
  )
  const summaries = computed(
    () =>
      new Map([...openByCve.value].map(([vulnId, group]) => [vulnId, summarizeDecisions(group)])),
  )

  return { openByCve, summaries }
}
