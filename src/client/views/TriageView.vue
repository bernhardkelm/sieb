<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadState from '@/components/common/LoadState.vue'
import BulkDecisionDialog from '@/components/decision/BulkDecisionDialog.vue'
import FilterBar from '@/components/filters/FilterBar.vue'
import TriageAllClear from '@/components/triage/TriageAllClear.vue'
import TriageList from '@/components/triage/TriageList.vue'
import TriageSelectionBar from '@/components/triage/TriageSelectionBar.vue'
import { TRIAGE_SORT_COLUMNS } from '@/components/triage/triageSort'
import TriageSummary from '@/components/triage/TriageSummary.vue'
import ViewToolbar from '@/components/layout/ViewToolbar.vue'
import SortMenu from '@/components/list/SortMenu.vue'
import { useClearSelectionOnBackgroundClick } from '@/composables/useClearSelectionOnBackgroundClick'
import { useTriageController } from '@/composables/useTriageController'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { hasActiveFilters } from '@/stores/findingFilters'
import { useFindingsStore } from '@/stores/findingsStore'
import { useLabelsStore } from '@/stores/labelsStore'

const store = useFindingsStore()
const labels = useLabelsStore()
const filterBar = ref<InstanceType<typeof FilterBar> | null>(null)

const triage = useTriageController(() => filterBar.value?.focusSearch())
const {
  filters,
  findings,
  sort,
  newCount,
  currentId,
  checkedIds,
  bulkOpen,
  bulkTargets,
  bulkStatus,
} = triage

const { hidden } = useLabelColumns()

useClearSelectionOnBackgroundClick(useTemplateRef<HTMLElement>('root'), triage.clearChecked)
</script>

<template>
  <div
    ref="root"
    class="triage-view list-view"
    data-list-background
    :data-list-checked="checkedIds.size > 0 || undefined"
  >
    <ViewToolbar>
      <FilterBar ref="filterBar" v-model:filters="filters" :resolved-toggle="false">
        <SortMenu
          :columns="TRIAGE_SORT_COLUMNS"
          :hidden="hidden"
          :sort="sort.sort.value"
          @change="sort.set"
        />
      </FilterBar>
    </ViewToolbar>
    <LoadState
      v-if="!store.loaded || labels.pending"
      subject="findings"
      :error="store.error"
      @retry="store.refresh()"
    />
    <TriageAllClear v-else-if="store.inboxTotal === 0 && !hasActiveFilters(filters, hidden)" />
    <template v-else>
      <TriageSummary
        :shown="findings.length"
        :total="store.inboxTotal"
        :new-count="newCount"
        :checked-count="checkedIds.size"
        :sort-label="sort.label.value"
        @bulk="triage.openBulk"
        @mark-seen="triage.markAllSeen"
        @reset-sort="triage.resetSort"
      />
      <EmptyState v-if="findings.length === 0" title="No matches">
        No findings to triage match these filters.
        <template #actions>
          <BaseButton variant="ghost" @click="triage.resetFilters()">Reset filters</BaseButton>
        </template>
      </EmptyState>
      <TriageList
        v-else
        :findings="findings"
        :current-id="currentId"
        :checked-ids="checkedIds"
        :sort="sort.sort.value"
        @select="triage.select"
        @sort="sort.toggle"
        @toggle="triage.toggleChecked"
      />
      <TriageSelectionBar :count="checkedIds.size" @clear="triage.clearChecked" />
    </template>
    <BulkDecisionDialog
      v-model:open="bulkOpen"
      :targets="bulkTargets"
      :status="bulkStatus"
      @done="triage.clearChecked"
    />
  </div>
</template>

<style scoped src="@/components/list/listView.css"></style>
