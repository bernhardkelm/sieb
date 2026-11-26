<script setup lang="ts">
import LoadState from '@/components/common/LoadState.vue'
import InboxAllClear from '@/components/inbox/InboxAllClear.vue'
import InboxList from '@/components/inbox/InboxList.vue'
import InboxSummary from '@/components/inbox/InboxSummary.vue'
import { useInboxController } from '@/composables/useInboxController'
import { useInboxStore } from '@/stores/inboxStore'

const store = useInboxStore()
const inbox = useInboxController()
const { items, currentKey, checkedKeys, seenTargets } = inbox
</script>

<template>
  <div class="inbox-view">
    <LoadState
      v-if="!store.loaded"
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
    </template>
    <RouterView v-slot="{ Component }">
      <component :is="Component" @resolved="inbox.onResolved" @close="inbox.closeProposal" />
    </RouterView>
  </div>
</template>
