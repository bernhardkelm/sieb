import { computed, type ComputedRef } from 'vue'

import type { ProposalDetail } from '#core/proposalApiTypes.ts'
import type { BulkTarget } from '@/components/decision/bulkTargets'
import type { DecisionFormInitial } from '@/components/decision/decisionFormModel'
import {
  NO_VERDICT_REASON,
  pendingRelated,
  RELATED_DONE_REASON,
  RELATED_SKIP_REASON,
  relatedBulkTargets,
  relatedDecisionPrefill,
} from '@/components/proposals/relatedFindings'
import { useSelectionAutoCheck } from '@/composables/useSelectionAutoCheck'
import type { BulkCount } from '@/format/bulkCount'

export interface RelatedFindingActions {
  /** Bulk decision targets of the open, undecided related findings */
  targets: ComputedRef<BulkTarget[]>
  /** Starting values of the bulk decision, null for an inconclusive proposal */
  prefill: ComputedRef<DecisionFormInitial | null>
  /** Related findings the bulk decision acts on out of all of them */
  decideCount: ComputedRef<BulkCount>
  /** Why the bulk decision cannot open, null while it can */
  decideBlockedBy: ComputedRef<string | null>
  /** Related findings the Auto-check queues out of all of them */
  checkCount: ComputedRef<BulkCount>
  /** Why no Auto-check can be queued, null while it can */
  checkBlockedBy: ComputedRef<string | null>
  /** Queues the Auto-checks, false while blocked */
  runCheck: () => Promise<boolean>
}

/**
 * Offers the actions on the related findings of a proposal: deciding the open, undecided ones
 * the way the proposal proposes, and queueing their Auto-checks with the selection Auto-check
 * and its block reasons. Decided and resolved findings are skipped by both and counted as such.
 * @param {() => ProposalDetail} detail - Getter of the reviewed proposal
 * @returns {RelatedFindingActions} - Targets, prefill, counts, block reasons and the check run
 */
export const useRelatedFindingActions = (detail: () => ProposalDetail): RelatedFindingActions => {
  const pending = computed(() => pendingRelated(detail().related))
  const autoCheck = useSelectionAutoCheck(() => pending.value.map((facts) => facts.findingId))
  const prefill = computed(() => relatedDecisionPrefill(detail()))
  const total = computed(() => detail().related.length)

  const decideBlockedBy = computed(() => {
    if (prefill.value === null) {
      return NO_VERDICT_REASON
    }

    return pending.value.length === 0 ? RELATED_DONE_REASON : null
  })

  return {
    targets: computed(() => relatedBulkTargets(pending.value)),
    prefill,
    decideCount: computed(() => ({
      affected: pending.value.length,
      selected: total.value,
      skipped: [RELATED_SKIP_REASON],
    })),
    decideBlockedBy,
    checkCount: computed(() => ({
      affected: autoCheck.count.value,
      selected: total.value,
      skipped: [
        ...(pending.value.length < total.value ? [RELATED_SKIP_REASON] : []),
        ...autoCheck.bulkCount.value.skipped,
      ],
    })),
    checkBlockedBy: computed(() =>
      pending.value.length === 0 ? RELATED_DONE_REASON : autoCheck.blockedBy.value,
    ),
    runCheck: autoCheck.run,
  }
}
