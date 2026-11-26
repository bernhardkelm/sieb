<script setup lang="ts">
import { ref } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadState from '@/components/common/LoadState.vue'
import BulkDecisionDialog from '@/components/decision/BulkDecisionDialog.vue'
import FilterBar from '@/components/filters/FilterBar.vue'
import InboxAllClear from '@/components/inbox/InboxAllClear.vue'
import InboxList from '@/components/inbox/InboxList.vue'
import InboxSelectionBar from '@/components/inbox/InboxSelectionBar.vue'
import { INBOX_SORT_COLUMNS } from '@/components/inbox/inboxSort'
import InboxSummary from '@/components/inbox/InboxSummary.vue'
import ViewToolbar from '@/components/layout/ViewToolbar.vue'
import SortMenu from '@/components/list/SortMenu.vue'
import { useInboxController } from '@/composables/useInboxController'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { hasActiveFilters } from '@/stores/findingFilters'
import { useFindingsStore } from '@/stores/findingsStore'
import { useLabelsStore } from '@/stores/labelsStore'

const store = useFindingsStore()
const labels = useLabelsStore()
const filterBar = ref<InstanceType<typeof FilterBar> | null>(null)

const inbox = useInboxController(() => filterBar.value?.focusSearch())
const { findings, sort, newCount, currentId, checkedIds, bulkOpen, bulkTargets, bulkStatus } = inbox

const { hidden } = useLabelColumns()
</script>

<template>
  <div class="inbox-view">
    <ViewToolbar>
      <FilterBar ref="filterBar" v-model:filters="store.filters" :resolved-toggle="false">
        <SortMenu
          :columns="INBOX_SORT_COLUMNS"
          :hidden="hidden"
          :sort="sort.sort.value"
          @change="sort.set"
        />
      </FilterBar>
    </ViewToolbar>
    <LoadState
      v-if="!store.loaded"
      subject="findings"
      :error="store.error"
      @retry="store.refresh()"
    />
    <InboxAllClear
      v-else-if="store.inboxTotal === 0 && !hasActiveFilters(store.filters, labels.showKev)"
    />
    <template v-else>
      <InboxSummary
        :shown="findings.length"
        :total="store.inboxTotal"
        :new-count="newCount"
        :checked-count="checkedIds.size"
        :sort-label="sort.label.value"
        @bulk="inbox.openBulk"
        @reset-sort="inbox.resetSort"
      />
      <EmptyState v-if="findings.length === 0" title="No matches">
        No inbox findings match these filters.
        <BaseButton variant="ghost" @click="store.resetFilters()">Reset filters</BaseButton>
      </EmptyState>
      <InboxList
        v-else
        :findings="findings"
        :current-id="currentId"
        :checked-ids="checkedIds"
        :sort="sort.sort.value"
        @select="inbox.select"
        @sort="sort.toggle"
        @toggle="inbox.toggleChecked"
      />
      <InboxSelectionBar :count="checkedIds.size" @clear="inbox.clearChecked" />
    </template>
    <BulkDecisionDialog
      v-model:open="bulkOpen"
      :targets="bulkTargets"
      :status="bulkStatus"
      @done="inbox.clearChecked"
    />
  </div>
</template>
