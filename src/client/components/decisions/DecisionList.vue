<script setup lang="ts">
import { computed } from 'vue'

import type { FindingView, DecisionView } from '#core/findingView.ts'
import DecisionDetail from '@/components/decisions/DecisionDetail.vue'
import DecisionRow from '@/components/decisions/DecisionRow.vue'
import DecisionListHeader from '@/components/decisions/DecisionListHeader.vue'
import type { DecisionSortColumn } from '@/components/decisions/decisionSort'
import NestedFindingRow from '@/components/finding/NestedFindingRow.vue'
import DenseList from '@/components/list/DenseList.vue'
import {
  flattenTree,
  isCursorItem,
  treeItemEstimate,
  treeItemKey,
} from '@/components/list/flattenTree'
import type { SortState } from '@/components/list/listSort'
import NestedPanel from '@/components/list/NestedPanel.vue'

const props = defineProps<{
  decisions: DecisionView[]
  expandedId: number | null
  currentKey: string | null
  /** Open findings governed by the expanded decision */
  findings: FindingView[]
  findingsLoaded: boolean
  /** A re-confirm is in flight */
  reconfirming?: boolean
  sort: SortState<DecisionSortColumn> | null
}>()

defineEmits<{
  select: [key: string]
  edit: [view: DecisionView]
  revoke: [view: DecisionView]
  openFinding: [view: DecisionView]
  reconfirm: [view: DecisionView]
  sort: [column: DecisionSortColumn]
}>()

const PANEL_ESTIMATE = 96

const items = computed(() =>
  flattenTree({
    groups: props.decisions,
    idOf: (view) => view.decision.id,
    expanded: props.expandedId,
    findings: props.findings,
    loaded: props.findingsLoaded,
    panel: true,
  }),
)
const estimate = treeItemEstimate(PANEL_ESTIMATE)
</script>

<template>
  <div class="decision-list">
    <DenseList
      class="columns"
      label="Decisions"
      kind="treegrid"
      :items="items"
      :key-of="treeItemKey"
      :estimate="estimate"
      :pinned="currentKey"
      :cursor-row="isCursorItem"
    >
      <template #header>
        <DecisionListHeader :sort="sort" @sort="$emit('sort', $event)" />
      </template>
      <template #default="{ item, attrs, measure }">
        <DecisionRow
          v-if="item.kind === 'group'"
          :ref="measure"
          v-bind="attrs"
          :view="item.group"
          :current="currentKey === item.key"
          :expanded="item.expanded"
          :data-row-key="item.key"
          @select="$emit('select', item.key)"
        />
        <NestedPanel v-else-if="item.kind === 'panel'" :ref="measure" v-bind="attrs">
          <DecisionDetail
            :view="item.group"
            :finding-count="findings.length"
            :busy="reconfirming"
            @edit="$emit('edit', item.group)"
            @reconfirm="$emit('reconfirm', item.group)"
            @revoke="$emit('revoke', item.group)"
            @open-finding="$emit('openFinding', item.group)"
          />
        </NestedPanel>
        <NestedFindingRow
          v-else
          :ref="measure"
          v-bind="attrs"
          :item="item"
          :current-key="currentKey"
          @select="$emit('select', $event)"
        />
      </template>
    </DenseList>
  </div>
</template>

<style scoped>
.decision-list {
  container-type: inline-size;
}

.columns {
  --row-columns: var(--chevron-size) calc(var(--space-base) * 26) var(--col-vuln-id)
    calc(var(--space-base) * 30) minmax(0, 1fr) calc(var(--space-base) * 20)
    calc(var(--space-base) * 18) calc(var(--space-base) * 16) var(--count-width);
}

@container (max-width: 900px) {
  .columns {
    --row-columns: var(--chevron-size) calc(var(--space-base) * 26) calc(var(--space-base) * 30)
      calc(var(--space-base) * 24) minmax(0, 1fr) calc(var(--space-base) * 14) var(--count-width);
  }
}
</style>
