<script setup lang="ts">
import LoadState from '@/components/common/LoadState.vue'
import BulkAcceptDialog from '@/components/inbox/BulkAcceptDialog.vue'
import BulkRejectDialog from '@/components/inbox/BulkRejectDialog.vue'
import InboxAllClear from '@/components/inbox/InboxAllClear.vue'
import InboxList from '@/components/inbox/InboxList.vue'
import InboxSelectionBar from '@/components/inbox/InboxSelectionBar.vue'
import InboxSummary from '@/components/inbox/InboxSummary.vue'
import { useInboxController } from '@/composables/useInboxController'
import { useInboxStore } from '@/stores/inboxStore'
import { useLabelsStore } from '@/stores/labelsStore'

const store = useInboxStore()
const labels = useLabelsStore()
const inbox = useInboxController()
const { items, currentKey, checkedKeys, seenTargets, bulk } = inbox
const { targets, acceptOpen, rejectOpen, busy, rejectError } = bulk
</script>

<template>
  <div class="inbox-view">
    <LoadState
      v-if="!store.loaded || labels.pending"
      subject="the Inbox"
      :error="store.error"
      @retry="store.refresh()"
    />
    <InboxAllClear v-else-if="items.length === 0" />
    <template v-else>
      <InboxSummary
        :counts="store.counts"
        :checked-count="checkedKeys.size"
        :seen-count="seenTargets.length"
        @mark-seen="inbox.markSeen()"
      />
      <InboxList
        :items="items"
        :current-key="currentKey"
        :checked-keys="checkedKeys"
        @select="inbox.select"
        @toggle="inbox.toggleChecked"
        @seen="inbox.markSeen([$event])"
      />
      <InboxSelectionBar :count="checkedKeys.size" @clear="inbox.clearChecked" />
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
