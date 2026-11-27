<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { InboxFindingTarget } from '#core/inbox/findingInboxItems.ts'
import { INBOX_KIND_TONES } from '@/components/chips/chipTones'
import PanelLine from '@/components/common/PanelLine.vue'
import StatusDot from '@/components/common/StatusDot.vue'
import { inboxItemRoute } from '@/components/inbox/inboxItems'
import { useNow } from '@/composables/useNow'
import { inboxMarkerDetail } from '@/format/inboxMarkerText'
import { useInboxStore } from '@/stores/inboxStore'

const props = defineProps<{
  finding: InboxFindingTarget
}>()

const inbox = useInboxStore()
const now = useNow()
// proposals have their own notice in the decision section
const items = computed(() =>
  inbox.itemsFor(props.finding).filter((item) => item.kind !== 'proposal'),
)
</script>

<template>
  <PanelLine
    v-if="items.length > 0"
    class="finding-inbox"
    label="In your Inbox"
    label-id="finding-inbox-label"
  >
    <ul class="items" aria-labelledby="finding-inbox-label">
      <li v-for="item in items" :key="item.key" class="item" :class="item.kind">
        <StatusDot :tone="INBOX_KIND_TONES[item.kind]" />
        <RouterLink :to="inboxItemRoute(item)" :data-inbox-item="item.key">{{
          inboxMarkerDetail(item, now)
        }}</RouterLink>
      </li>
    </ul>
  </PanelLine>
</template>

<style scoped>
.items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
}
</style>
