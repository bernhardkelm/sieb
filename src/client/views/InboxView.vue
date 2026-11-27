<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import { countInboxItems } from '#core/inbox/buildInbox.ts'
import BaseButton from '@/components/common/BaseButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadState from '@/components/common/LoadState.vue'
import BulkAcceptDialog from '@/components/inbox/BulkAcceptDialog.vue'
import BulkRejectDialog from '@/components/inbox/BulkRejectDialog.vue'
import InboxAllClear from '@/components/inbox/InboxAllClear.vue'
import InboxFilterBar from '@/components/inbox/InboxFilterBar.vue'
import InboxList from '@/components/inbox/InboxList.vue'
import InboxSelectionBar from '@/components/inbox/InboxSelectionBar.vue'
import InboxSummary from '@/components/inbox/InboxSummary.vue'
import ViewToolbar from '@/components/layout/ViewToolbar.vue'
import { useClearSelectionOnBackgroundClick } from '@/composables/useClearSelectionOnBackgroundClick'
import { useInboxController } from '@/composables/useInboxController'
import { useInboxStore } from '@/stores/inboxStore'
import { useLabelsStore } from '@/stores/labelsStore'

const store = useInboxStore()
const labels = useLabelsStore()
const filterBar = ref<InstanceType<typeof InboxFilterBar> | null>(null)
const inbox = useInboxController(() => filterBar.value?.focusSearch())
const { filters, items, currentKey, checkedKeys, seenTargets, bulk } = inbox
const shownCounts = computed(() => countInboxItems(items.value))
const { targets, counts, acceptOpen, rejectOpen, busy, rejectError } = bulk

useClearSelectionOnBackgroundClick(useTemplateRef<HTMLElement>('root'), inbox.clearChecked)
</script>

<template>
  <div
    ref="root"
    class="inbox-view list-view"
    data-list-background
    :data-list-checked="checkedKeys.size > 0 || undefined"
  >
    <ViewToolbar>
      <InboxFilterBar ref="filterBar" v-model:filters="filters" />
    </ViewToolbar>
    <LoadState
      v-if="!store.loaded || labels.pending"
      subject="the Inbox"
      :error="store.error"
      @retry="store.refresh()"
    />
    <InboxAllClear v-else-if="store.items.length === 0" />
    <template v-else>
      <InboxSummary
        :counts="shownCounts"
        :total="store.counts.total"
        :checked-count="checkedKeys.size"
        :seen-count="seenTargets.length"
        :bulk-counts="counts"
        @mark-seen="inbox.markSeen()"
      />
      <EmptyState v-if="items.length === 0" title="No matches">
        No Inbox items match these filters.
        <template #actions>
          <BaseButton variant="ghost" @click="inbox.resetFilters()">Reset filters</BaseButton>
        </template>
      </EmptyState>
      <InboxList
        v-else
        :items="items"
        :current-key="currentKey"
        :checked-keys="checkedKeys"
        @select="inbox.select"
        @toggle="inbox.toggleChecked"
        @seen="inbox.markSeen([$event])"
      />
      <InboxSelectionBar :count="checkedKeys.size" :counts="counts" @clear="inbox.clearChecked" />
    </template>
    <BulkAcceptDialog
      v-model:open="acceptOpen"
      :proposals="targets.proposals"
      :busy="busy"
      @confirm="bulk.accept()"
    />
    <BulkRejectDialog
      v-model:open="rejectOpen"
      :count="targets.proposals.length"
      :busy="busy"
      :error="rejectError"
      @confirm="bulk.reject"
    />
    <RouterView v-slot="{ Component }">
      <component :is="Component" @resolved="inbox.onResolved" @close="inbox.closeProposal" />
    </RouterView>
  </div>
</template>

<style scoped src="@/components/list/listView.css"></style>
