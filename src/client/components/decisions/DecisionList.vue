<script setup lang="ts">
import type { FindingView, DecisionView } from '#core/findingView.ts'
import DecisionDetail from '@/components/decisions/DecisionDetail.vue'
import DecisionRow from '@/components/decisions/DecisionRow.vue'
import { DECISION_SORT_COLUMNS, type DecisionSortColumn } from '@/components/decisions/decisionSort'
import NestedFindingRows from '@/components/finding/NestedFindingRows.vue'
import DenseList from '@/components/list/DenseList.vue'
import ListHeader from '@/components/list/ListHeader.vue'
import type { SortState } from '@/components/list/listSort'
import SortHeader from '@/components/list/SortHeader.vue'
import NestedPanel from '@/components/list/NestedPanel.vue'
import { groupRowKey } from '@/keyboard/rowKey'

defineProps<{
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

const columns = DECISION_SORT_COLUMNS
</script>

<template>
  <div class="decision-list">
    <DenseList class="columns" label="Decisions" kind="treegrid">
      <ListHeader>
        <span aria-hidden="true" />
        <SortHeader column="state" :columns="columns" :sort="sort" @sort="$emit('sort', $event)" />
        <SortHeader column="vulnId" :columns="columns" :sort="sort" @sort="$emit('sort', $event)" />
        <SortHeader column="scope" :columns="columns" :sort="sort" @sort="$emit('sort', $event)" />
        <span role="columnheader">Reason</span>
        <SortHeader
          class="optional"
          column="createdBy"
          short="By"
          :columns="columns"
          :sort="sort"
          @sort="$emit('sort', $event)"
        />
        <SortHeader
          class="optional"
          column="createdAt"
          :columns="columns"
          :sort="sort"
          @sort="$emit('sort', $event)"
        />
        <SortHeader
          column="expiresAt"
          :columns="columns"
          :sort="sort"
          @sort="$emit('sort', $event)"
        />
        <SortHeader
          column="openFindings"
          short="Open"
          end
          :columns="columns"
          :sort="sort"
          @sort="$emit('sort', $event)"
        />
      </ListHeader>
      <template v-for="view in decisions" :key="view.decision.id">
        <DecisionRow
          :view="view"
          :current="currentKey === groupRowKey(view.decision.id)"
          :expanded="expandedId === view.decision.id"
          :data-row-key="groupRowKey(view.decision.id)"
          @click="$emit('select', groupRowKey(view.decision.id))"
        />
        <template v-if="expandedId === view.decision.id">
          <NestedPanel>
            <DecisionDetail
              :view="view"
              :finding-count="findings.length"
              :busy="reconfirming"
              @edit="$emit('edit', view)"
              @reconfirm="$emit('reconfirm', view)"
              @revoke="$emit('revoke', view)"
              @open-finding="$emit('openFinding', view)"
            />
          </NestedPanel>
          <NestedFindingRows
            :findings="findings"
            :current-key="currentKey"
            :loaded="findingsLoaded"
            @select="$emit('select', $event)"
          />
        </template>
      </template>
    </DenseList>
  </div>
</template>

<style scoped>
.decision-list {
  container-type: inline-size;
}

.columns {
  --row-columns: var(--chevron-size) calc(var(--space-base) * 26) calc(var(--space-base) * 34)
    calc(var(--space-base) * 30) minmax(0, 1fr) calc(var(--space-base) * 20)
    calc(var(--space-base) * 18) calc(var(--space-base) * 16) var(--count-width);
}

@container (max-width: 900px) {
  .columns {
    --row-columns: var(--chevron-size) calc(var(--space-base) * 26) calc(var(--space-base) * 30)
      calc(var(--space-base) * 24) minmax(0, 1fr) calc(var(--space-base) * 14) var(--count-width);
  }

  .optional {
    display: none;
  }
}
</style>
