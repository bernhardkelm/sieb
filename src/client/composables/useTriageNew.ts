import { computed, type ComputedRef, type Ref } from 'vue'

import { isUnseenNew } from '#core/findingRecency.ts'
import type { FindingView } from '#core/findingView.ts'
import { useNow } from '@/composables/useNow'
import { useFindingSeenStore } from '@/stores/findingSeenStore'

export interface TriageNew {
  /** Listed findings new for the user, recent and not seen yet */
  newCount: ComputedRef<number>
  /** Marks every listed new finding seen */
  markAllSeen: () => void
}

/**
 * Counts the findings of the filtered Triage list that are new for the user and marks them seen
 * together.
 * @param {Readonly<Ref<FindingView[]>>} findings - Filtered Triage list
 * @returns {TriageNew} - Count and the mark action
 */
export const useTriageNew = (findings: Readonly<Ref<FindingView[]>>): TriageNew => {
  const now = useNow()
  const seen = useFindingSeenStore()
  const newIds = computed(() =>
    findings.value.filter((finding) => isUnseenNew(finding, now.value)).map(({ id }) => id),
  )

  return {
    newCount: computed(() => newIds.value.length),
    markAllSeen: () => {
      seen.markSeen(newIds.value)
    },
  }
}
