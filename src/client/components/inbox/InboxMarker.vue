<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import HintTooltip from '@/components/common/HintTooltip.vue'
import type { InboxFindingTarget } from '@/components/inbox/findingInboxItems'
import { inboxItemRoute } from '@/components/inbox/inboxItems'
import { useNow } from '@/composables/useNow'
import { inboxMarkerHint, inboxMarkerLabel } from '@/format/inboxMarkerText'
import { useInboxStore } from '@/stores/inboxStore'

const props = defineProps<{
  finding: InboxFindingTarget
}>()

const inbox = useInboxStore()
const now = useNow()
const item = computed(() => inbox.itemsFor(props.finding)[0] ?? null)
</script>

<template>
  <span v-if="item" class="inbox-marker">
    <HintTooltip :text="inboxMarkerHint(item, now)">
      <!-- out of the Tab order inside the listbox option, the finding panel lists the same links -->
      <RouterLink
        class="marker-chip"
        :class="item.kind"
        :to="inboxItemRoute(item)"
        tabindex="-1"
        :data-inbox-item="item.key"
        @click.stop
      >
        {{ inboxMarkerLabel(item) }}
      </RouterLink>
    </HintTooltip>
  </span>
</template>

<style scoped>
.inbox-marker {
  display: inline-flex;
  vertical-align: middle;
}

.marker-chip {
  --marker-color: var(--color-claim);
  --marker-wash: var(--color-claim-wash);

  display: inline-flex;
  flex: none;
  align-items: center;
  height: var(--chip-height);
  padding: 0 var(--space-1-5);
  border: var(--border-width) dashed color-mix(in srgb, var(--marker-color) 60%, transparent);
  border-radius: var(--radius-sm);
  background: var(--marker-wash);
  color: var(--marker-color);
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}

.marker-chip:hover {
  border-style: solid;
  border-color: var(--marker-color);
}

.reopened {
  --marker-color: var(--color-danger);
  --marker-wash: var(--color-danger-wash);
}

.kev {
  --marker-color: var(--color-kev);
  --marker-wash: var(--color-kev-wash);
}

.expiring {
  --marker-color: var(--color-warning);
  --marker-wash: var(--color-warning-wash);
}
</style>
