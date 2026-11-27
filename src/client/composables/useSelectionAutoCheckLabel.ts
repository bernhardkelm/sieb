import { computed, type ComputedRef } from 'vue'

import { useSelectionAutoCheck } from '@/composables/useSelectionAutoCheck'
import { bulkLabel, FINDING_NOUN } from '@/format/bulkCount'

export interface SelectionAutoCheckLabel {
  /** Visible label, such as "Auto-check 4" */
  text: ComputedRef<string>
  /** Accessible label, and the partial tooltip while the check is not blocked */
  attrs: ComputedRef<Record<string, string>>
}

/**
 * Labels the Auto-check of the checked rows with the number of findings it queues, rows with an
 * open check left out. While it leaves rows out and can run, the tooltip names how many of the
 * checked rows it queues; a blocked check keeps its block reason as tooltip.
 * @returns {SelectionAutoCheckLabel} - Label text and the attributes for the button
 */
export const useSelectionAutoCheckLabel = (): SelectionAutoCheckLabel => {
  const autoCheck = useSelectionAutoCheck()

  const labels = computed(() => bulkLabel('Auto-check', autoCheck.bulkCount.value, FINDING_NOUN))

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
