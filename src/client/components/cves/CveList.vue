<script setup lang="ts">
import { computed } from 'vue'

import type { CveAggregate } from '#core/cveAggregation.ts'
import type { FindingView } from '#core/findingView.ts'
import CveActions from '@/components/cves/CveActions.vue'
import CveRow from '@/components/cves/CveRow.vue'
import { CVE_SORT_COLUMNS, type CveSortColumn } from '@/components/cves/cveSort'
import NestedFindingRow from '@/components/finding/NestedFindingRow.vue'
import DenseList from '@/components/list/DenseList.vue'
import {
  flattenTree,
  isCursorItem,
  treeItemEstimate,
  treeItemKey,
} from '@/components/list/flattenTree'
import ListHeader from '@/components/list/ListHeader.vue'
import type { SortState } from '@/components/list/listSort'
import SortHeader from '@/components/list/SortHeader.vue'
import NestedPanel from '@/components/list/NestedPanel.vue'
import { useLabelColumns } from '@/composables/useLabelColumns'

const props = defineProps<{
  cves: CveAggregate[]
  expandedId: string | null
  currentKey: string | null
  /** Open findings of the expanded CVE */
  findings: FindingView[]
  findingsLoaded: boolean
  /** Decision summary per vuln_id */
  summaries: Map<string, string>
  sort: SortState<CveSortColumn> | null
}>()

defineEmits<{
  select: [key: string]
  bulk: [vulnId: string]
  decideAll: [vulnId: string]
  sort: [column: CveSortColumn]
}>()

const columns = CVE_SORT_COLUMNS
const PANEL_ESTIMATE = 49
const { hidden, classes } = useLabelColumns()

const items = computed(() =>
  flattenTree({
    groups: props.cves,
    idOf: (cve) => cve.vulnId,
    expanded: props.expandedId,
    findings: props.findings,
    loaded: props.findingsLoaded,
    panel: true,
  }),
)
const estimate = treeItemEstimate(PANEL_ESTIMATE)
</script>

<template>
  <div class="cve-list">
    <DenseList
      class="columns"
      :class="classes"
      label="CVEs"
      kind="treegrid"
      :items="items"
      :key-of="treeItemKey"
      :estimate="estimate"
      :pinned="currentKey"
      :cursor-row="isCursorItem"
    >
      <template #header>
        <ListHeader>
          <span aria-hidden="true" />
          <SortHeader
            column="severity"
            :columns="columns"
            :sort="sort"
            @sort="$emit('sort', $event)"
          />
          <SortHeader
            v-if="!hidden.includes('kev')"
            column="kev"
            :columns="columns"
            :sort="sort"
            @sort="$emit('sort', $event)"
          />
          <SortHeader
            column="vulnId"
            :columns="columns"
            :sort="sort"
            @sort="$emit('sort', $event)"
          />
          <SortHeader
            class="optional"
            column="title"
            :columns="columns"
            :sort="sort"
            @sort="$emit('sort', $event)"
          />
          <SortHeader
            column="images"
            end
            :columns="columns"
            :sort="sort"
            @sort="$emit('sort', $event)"
          />
          <SortHeader
            v-if="!hidden.includes('exposure')"
            class="optional"
            column="exposure"
            :columns="columns"
            :sort="sort"
            @sort="$emit('sort', $event)"
          />
          <SortHeader
            column="open"
            end
            :columns="columns"
            :sort="sort"
            @sort="$emit('sort', $event)"
          />
          <SortHeader
            column="inbox"
            end
            :columns="columns"
            :sort="sort"
            @sort="$emit('sort', $event)"
          />
          <span role="columnheader">Decisions</span>
        </ListHeader>
      </template>
      <template #default="{ item, attrs, measure }">
        <CveRow
          v-if="item.kind === 'group'"
          :ref="measure"
          v-bind="attrs"
          :cve="item.group"
          :current="currentKey === item.key"
          :expanded="item.expanded"
          :summary="summaries.get(item.group.vulnId) ?? ''"
          :data-row-key="item.key"
          @select="$emit('select', item.key)"
        />
        <NestedPanel v-else-if="item.kind === 'panel'" :ref="measure" v-bind="attrs">
          <CveActions
            :cve="item.group"
            @bulk="$emit('bulk', item.group.vulnId)"
            @decide-all="$emit('decideAll', item.group.vulnId)"
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

<style scoped src="@/components/cves/cveColumns.css"></style>
