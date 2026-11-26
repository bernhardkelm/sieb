import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { Decision } from '#core/decision.ts'
import { leavesInbox, type EffectiveDecision } from '#core/effectiveDecision.ts'
import { filterFindings } from '#core/findingFilter.ts'
import type { FindingListView } from '#core/findingQuery.ts'
import type { FindingView } from '#core/findingView.ts'
import { fetchFindings } from '@/api/findingsApi'
import { useRemoteList } from '@/composables/useRemoteList'
import { useLabelsStore } from '@/stores/labelsStore'
import { emptyFilters, toFindingQuery, type FindingFilters } from '@/stores/findingFilters'

/**
 * Holds every finding, resolved ones included, and the shared filters. Lists are filtered on the
 * client with the core filter, so typing in the search narrows instantly. Refetches whenever the
 * data version moves, see useRemoteList.
 */
export const useFindingsStore = defineStore('findings', () => {
  const now = ref(new Date())
  const { items, loading, loaded, error, refresh, ensureLoaded } = useRemoteList(
    () => fetchFindings({ view: 'all', includeResolved: true }),
    () => {
      now.value = new Date()
    },
  )
  const labels = useLabelsStore()
  const filters = ref<FindingFilters>(emptyFilters())

  /**
   * Returns the findings of a list view that pass the filters.
   * @param {FindingListView} view - Inbox or all findings
   * @returns {FindingView[]} - Findings in inbox order
   */
  const list = (view: FindingListView): FindingView[] =>
    filterFindings(items.value, toFindingQuery(filters.value, view, now.value, labels.showKev))

  const inbox = computed(() => list('inbox'))
  const inboxTotal = computed(() => items.value.filter((finding) => finding.inInbox).length)

  /**
   * Applies a created or changed decision to the loaded findings before the refetch confirms
   * it, so the row leaves the inbox at once. Findings with their own image decision keep it for
   * scope all. Revocations are not applied, the refetch tells which decision governs then.
   * @param {Decision} decision - Written decision
   * @param {EffectiveDecision} effective - State of the written decision
   * @returns {void}
   */
  const applyDecision = (decision: Decision, effective: EffectiveDecision): void => {
    if (effective.state === 'revoked') {
      return
    }

    const inInbox = !leavesInbox(effective)

    items.value = items.value.map((finding) => {
      const matches =
        finding.vulnId === decision.vulnId &&
        (decision.scope === 'all'
          ? finding.decision?.scope !== 'image'
          : finding.imageRef === decision.imageRef)

      return matches && finding.resolvedAt === null
        ? { ...finding, decision, effective, inInbox }
        : finding
    })
  }

  /**
   * Changes some filters.
   * @param {Partial<FindingFilters>} patch - Changed filters
   * @returns {void}
   */
  const setFilters = (patch: Partial<FindingFilters>): void => {
    filters.value = { ...filters.value, ...patch }
  }

  /**
   * Clears every filter.
   * @returns {void}
   */
  const resetFilters = (): void => {
    filters.value = emptyFilters()
  }

  return {
    items,
    loading,
    loaded,
    error,
    filters,
    now,
    inbox,
    inboxTotal,
    list,
    refresh,
    ensureLoaded,
    applyDecision,
    setFilters,
    resetFilters,
  }
})
