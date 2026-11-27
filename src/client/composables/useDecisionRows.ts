import { computed, ref, type ComputedRef, type Ref, type WritableComputedRef } from 'vue'

import type { DecisionFilter } from '#core/decisionFilter.ts'
import type { DecisionView, FindingView } from '#core/findingView.ts'
import { searchDecisions } from '@/components/decisions/decisionSearch'
import {
  DECISION_SORT_COLUMNS,
  sortDecisions,
  type DecisionSortColumn,
} from '@/components/decisions/decisionSort'
import {
  countDecisionTabs,
  decisionsInTab,
  parseDecisionTab,
} from '@/components/decisions/decisionTabs'
import { governedFindings } from '@/components/decisions/governedFindings'
import { useExpandedGroup, type ExpandedGroup } from '@/composables/useExpandedGroup'
import { useListSort, type ListSort } from '@/composables/useListSort'
import { useNow } from '@/composables/useNow'
import { useQueryParam } from '@/composables/useQueryParam'
import { findingRowKey, groupRowKey } from '@/keyboard/rowKey'
import { DECISION_QUERY, DECISION_TAB_QUERY } from '@/router/routeNames'
import { useDecisionsStore } from '@/stores/decisionsStore'
import { useFindingsStore } from '@/stores/findingsStore'

export interface DecisionRows {
  q: Ref<string>
  tab: WritableComputedRef<DecisionFilter>
  counts: ComputedRef<Record<DecisionFilter, number>>
  /** Decisions of the tab that match the search, in the sort order */
  decisions: ComputedRef<DecisionView[]>
  sort: ListSort<DecisionSortColumn>
  expanded: ExpandedGroup
  expandedId: ComputedRef<number | null>
  expandedFindings: ComputedRef<FindingView[]>
  /** Row keys in list order, the expanded decision followed by its governed findings */
  keys: ComputedRef<string[]>
}

/**
 * Lists the rows of the decisions view: the tab of the `state` query param, the search, the sort
 * of the `sort` and `dir` query params, and the decision expanded through the `decision` query
 * param with its governed open findings.
 * @returns {DecisionRows} - Tab, search, sort, decisions and row keys
 */
export const useDecisionRows = (): DecisionRows => {
  const store = useDecisionsStore()
  const findings = useFindingsStore()
  const now = useNow()
  const tabParam = useQueryParam(DECISION_TAB_QUERY)
  const expanded = useExpandedGroup(DECISION_QUERY)
  const q = ref('')

  const tab = computed({
    get: () => parseDecisionTab(tabParam.value.value),
    set: (value: DecisionFilter) => {
      void tabParam.set(value)
    },
  })
  const searched = computed(() => searchDecisions(store.items, q.value))
  const sort = useListSort(DECISION_SORT_COLUMNS)
  const decisions = computed(() =>
    sortDecisions(decisionsInTab(searched.value, tab.value, now.value), sort.sort.value),
  )
  const expandedId = computed(() =>
    expanded.value.value === null ? null : Number(expanded.value.value),
  )
  const expandedView = computed(
    () => decisions.value.find((view) => view.decision.id === expandedId.value) ?? null,
  )
  const expandedFindings = computed(() =>
    expandedView.value ? governedFindings(expandedView.value.decision, findings.items) : [],
  )

  return {
    q,
    tab,
    counts: computed(() => countDecisionTabs(searched.value, now.value)),
    decisions,
    sort,
    expanded,
    expandedId,
    expandedFindings,
    keys: computed(() =>
      decisions.value.flatMap((view) => [
        groupRowKey(view.decision.id),
        ...(view.decision.id === expandedId.value
          ? expandedFindings.value.map((finding) => findingRowKey(finding.id))
          : []),
      ]),
    ),
  }
}
