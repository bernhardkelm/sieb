import { computed, type ComputedRef } from 'vue'

import { useSelectionAutoCheck } from '@/composables/useSelectionAutoCheck'
import { bulkLabel } from '@/format/bulkCount'
import { OPEN_SKIP_REASON } from '@/format/checkBlockReason'
import { useHandoffSelectionStore } from '@/stores/handoffSelectionStore'

export interface SelectionAutoCheckLabel {
  /** Visible label, such as "Auto-check 4" */
  text: ComputedRef<string>
  /** Accessible label, and the partial tooltip while the check is not blocked */
  attrs: ComputedRef<Record<string, string>>
}

const NOUN = { singular: 'finding' }

/**
 * Labels the Auto-check of the checked rows with the number of findings it queues, rows with an
 * open check left out. While it leaves rows out and can run, the tooltip names how many of the
 * checked rows it queues; a blocked check keeps its block reason as tooltip.
 * @returns {SelectionAutoCheckLabel} - Label text and the attributes for the button
 */
export const useSelectionAutoCheckLabel = (): SelectionAutoCheckLabel => {
  const autoCheck = useSelectionAutoCheck()
  const selection = useHandoffSelectionStore()

  const labels = computed(() =>
    bulkLabel(
      'Auto-check',
      {
        affected: autoCheck.count.value,
        selected: selection.findingIds.length,
        skipped: [OPEN_SKIP_REASON],
      },
      NOUN,
    ),
  )

  const attrs = computed<Record<string, string>>(() => {
    const { ariaLabel, partial } = labels.value
    const result: Record<string, string> = { 'aria-label': ariaLabel }

    if (partial !== undefined && autoCheck.blockedBy.value === null) {
      result.title = partial
    }

    return result
  })

  return { text: computed(() => labels.value.text), attrs }
}
