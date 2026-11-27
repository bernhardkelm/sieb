import type { DecisionView } from '#core/findingView.ts'
import { useDataVersionStore } from '@/stores/dataVersionStore'
import { useFindingSeenStore } from '@/stores/findingSeenStore'
import { useFindingsStore } from '@/stores/findingsStore'

export interface DecisionSettle {
  /** Applies written decisions to the findings and bumps the data version */
  settle: (views: DecisionView[]) => void
  /** Marks the loaded findings that created decisions cover as seen */
  markDecidedSeen: (views: DecisionView[]) => void
}

/**
 * Applies written decisions to the loaded findings at once, revoked ones excepted since another
 * decision may still govern their findings, and announces the change so lists and the panel
 * refetch.
 * @returns {DecisionSettle} - Settle and mark functions
 */
export const useDecisionSettle = (): DecisionSettle => {
  const findings = useFindingsStore()
  const dataVersion = useDataVersionStore()
  const seen = useFindingSeenStore()

  /**
   * Applies written decisions and announces the change.
   * @param {DecisionView[]} views - Written decisions
   * @returns {void}
   */
  const settle = (views: DecisionView[]): void => {
    for (const view of views) {
      if (view.effective.state !== 'revoked') {
        findings.applyDecision(view.decision, view.effective)
      }
    }

    dataVersion.bump()
  }

  /**
   * Marks the loaded findings a bulk decision created decisions for as seen.
   * @param {DecisionView[]} views - Created decisions
   * @returns {void}
   */
  const markDecidedSeen = (views: DecisionView[]): void => {
    const keys = new Set(views.map(({ decision }) => `${decision.vulnId}\n${decision.imageRef}`))

    seen.markSeen(
      findings.items
        .filter((finding) => keys.has(`${finding.vulnId}\n${finding.imageRef}`))
        .map((finding) => finding.id),
    )
  }

  return { settle, markDecidedSeen }
}
