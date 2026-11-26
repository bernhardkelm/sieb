<script setup lang="ts">
import { ref } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadState from '@/components/common/LoadState.vue'
import BulkDecisionDialog from '@/components/decision/BulkDecisionDialog.vue'
import FilterBar from '@/components/filters/FilterBar.vue'
import InboxList from '@/components/inbox/InboxList.vue'
import { INBOX_SORT_COLUMNS } from '@/components/inbox/inboxSort'
import InboxSummary from '@/components/inbox/InboxSummary.vue'
import ViewToolbar from '@/components/layout/ViewToolbar.vue'
import SortMenu from '@/components/list/SortMenu.vue'
import { useInboxController } from '@/composables/useInboxController'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { useFindingsStore } from '@/stores/findingsStore'

const store = useFindingsStore()
const filterBar = ref<InstanceType<typeof FilterBar> | null>(null)

const inbox = useInboxController(() => filterBar.value?.focusSearch())
const { findings, sort, newCount, currentId, checkedIds, bulkOpen, bulkTargets } = inbox

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
    <EmptyState v-else-if="store.inboxTotal === 0" title="Inbox zero">
      Every open finding has a decision. New findings show up here after the next sync.
    </EmptyState>
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
    </template>
    <BulkDecisionDialog v-model:open="bulkOpen" :targets="bulkTargets" @done="inbox.clearChecked" />
  </div>
</template>
