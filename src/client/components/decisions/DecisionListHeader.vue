<script setup lang="ts">
import { DECISION_SORT_COLUMNS, type DecisionSortColumn } from '@/components/decisions/decisionSort'
import ListHeader from '@/components/list/ListHeader.vue'
import type { SortState } from '@/components/list/listSort'
import SortHeader from '@/components/list/SortHeader.vue'

defineProps<{
  sort: SortState<DecisionSortColumn> | null
}>()

defineEmits<{ sort: [column: DecisionSortColumn] }>()

interface HeaderCell {
  /** Sortable column, null for the Reason column, which does not sort */
  column: DecisionSortColumn | null
  short?: string
  end?: boolean
  /** Hidden in narrow containers */
  optional?: boolean
}

const CELLS: HeaderCell[] = [
  { column: 'state' },
  { column: 'vulnId' },
  { column: 'scope' },
  { column: null },
  { column: 'createdBy', short: 'By', optional: true },
  { column: 'createdAt', optional: true },
  { column: 'expiresAt' },
  { column: 'openFindings', short: 'Open', end: true },
]
</script>

<template>
  <ListHeader>
    <span aria-hidden="true" />
    <template v-for="cell in CELLS" :key="cell.column ?? 'reason'">
      <span v-if="cell.column === null" role="columnheader">Reason</span>
      <SortHeader
        v-else
        :class="{ optional: cell.optional }"
        :column="cell.column"
        :short="cell.short"
        :end="cell.end"
        :columns="DECISION_SORT_COLUMNS"
        :sort="sort"
        @sort="$emit('sort', $event)"
      />
    </template>
  </ListHeader>
</template>

<style scoped>
@container (max-width: 900px) {
  .optional {
    display: none;
  }
}
</style>
