<script setup lang="ts">
import { isUnseenNew } from '#core/findingRecency.ts'
import type { FindingView } from '#core/findingView.ts'
import FindingRow from '@/components/finding/FindingRow.vue'
import { TRIAGE_SORT_COLUMNS, type TriageSortColumn } from '@/components/triage/triageSort'
import DenseList from '@/components/list/DenseList.vue'
import ListHeader from '@/components/list/ListHeader.vue'
import type { SortState } from '@/components/list/listSort'
import SortHeader from '@/components/list/SortHeader.vue'
import { rowEstimate } from '@/components/list/virtualRows'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { useNow } from '@/composables/useNow'

defineProps<{
  findings: FindingView[]
  currentId: number | null
  checkedIds: Set<number>
  sort: SortState<TriageSortColumn> | null
}>()

defineEmits<{
  select: [id: number, event: MouseEvent]
  toggle: [id: number, event: MouseEvent]
  sort: [column: TriageSortColumn]
}>()

const now = useNow()
const columns = TRIAGE_SORT_COLUMNS
const { hidden, classes } = useLabelColumns()

/**
 * Returns the virtualizer key of a triage row, its finding id as the cursor uses it.
 * @param {FindingView} finding - Finding
 * @returns {number} - Finding id
 */
const idOf = (finding: FindingView): number => finding.id

/**
 * Estimates the height of a triage row until it is measured.
 * @param {FindingView} _finding - Finding
 * @param {boolean} narrow - Whether the row wraps to two lines
 * @returns {number} - Height in px
 */
const estimate = (_finding: FindingView, narrow: boolean): number => rowEstimate(narrow)
</script>

<template>
  <div class="triage-list" data-list-background>
    <ListHeader class="finding-columns" :class="classes" label="Triage columns">
      <span aria-hidden="true" />
      <SortHeader column="severity" :columns="columns" :sort="sort" @sort="$emit('sort', $event)" />
      <SortHeader
        v-if="!hidden.includes('kev')"
        column="kev"
        :columns="columns"
        :sort="sort"
        @sort="$emit('sort', $event)"
      />
      <SortHeader column="vulnId" :columns="columns" :sort="sort" @sort="$emit('sort', $event)" />
      <SortHeader
        class="wide-only"
        column="title"
        :columns="columns"
        :sort="sort"
        @sort="$emit('sort', $event)"
      />
      <SortHeader column="image" :columns="columns" :sort="sort" @sort="$emit('sort', $event)" />
      <SortHeader
        v-if="!hidden.includes('exposure')"
        column="exposure"
        :columns="columns"
        :sort="sort"
        @sort="$emit('sort', $event)"
      />
      <SortHeader
        v-if="!hidden.includes('owner')"
        class="wide-only"
        column="owner"
        :columns="columns"
        :sort="sort"
        @sort="$emit('sort', $event)"
      />
      <SortHeader
        class="wide-only"
        column="workloads"
        short="Workl."
        end
        :columns="columns"
        :sort="sort"
        @sort="$emit('sort', $event)"
      />
      <SortHeader
        column="firstSeen"
        short="Seen"
        end
        :columns="columns"
        :sort="sort"
        @sort="$emit('sort', $event)"
      />
    </ListHeader>
    <DenseList
      label="Findings to triage"
      :items="findings"
      :key-of="idOf"
      :estimate="estimate"
      :pinned="currentId"
    >
      <template #default="{ item: finding, attrs, measure }">
        <FindingRow
          :ref="measure"
          v-bind="attrs"
          :finding="finding"
          :current="finding.id === currentId"
          :checked="checkedIds.has(finding.id)"
          :is-new="isUnseenNew(finding, now)"
          @select="$emit('select', finding.id, $event)"
          @toggle="$emit('toggle', finding.id, $event)"
        />
      </template>
    </DenseList>
  </div>
</template>

<style scoped src="@/components/finding/findingColumns.css"></style>

<style scoped>
.triage-list {
  container-type: inline-size;
}
</style>
