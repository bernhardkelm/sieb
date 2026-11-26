<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { InboxFindingTarget } from '@/components/inbox/findingInboxItems'
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
  <div v-if="items.length > 0" class="finding-inbox">
    <span id="finding-inbox-label" class="label">In your Inbox</span>
    <ul class="items" aria-labelledby="finding-inbox-label">
      <li v-for="item in items" :key="item.key" class="item" :class="item.kind">
        <span class="dot" aria-hidden="true" />
        <RouterLink :to="inboxItemRoute(item)" :data-inbox-item="item.key">{{
          inboxMarkerDetail(item, now)
        }}</RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.finding-inbox {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
}

.label {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
}

.items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  --item-color: var(--color-danger);

  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
}

.kev {
  --item-color: var(--color-kev);
}

.expiring {
  --item-color: var(--color-warning);
}

.dot {
  width: var(--dot-size);
  height: var(--dot-size);
  border-radius: var(--radius-pill);
  background: var(--item-color);
}
</style>
