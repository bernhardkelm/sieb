<script setup lang="ts">
import { computed } from 'vue'

import BaseChip from '@/components/chips/BaseChip.vue'
import { INBOX_KIND_TONES } from '@/components/chips/chipTones'
import HintTooltip from '@/components/common/HintTooltip.vue'
import type { InboxFindingTarget } from '#core/inbox/findingInboxItems.ts'
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
      <BaseChip
        class="marker-chip"
        :tone="INBOX_KIND_TONES[item.kind]"
        :variant="item.kind === 'proposal' ? 'pending' : 'wash'"
        :to="inboxItemRoute(item)"
        tabindex="-1"
        :data-inbox-item="item.key"
        @click.stop
      >
        {{ inboxMarkerLabel(item) }}
      </BaseChip>
    </HintTooltip>
  </span>
</template>

<style scoped>
.inbox-marker {
  display: inline-flex;
  vertical-align: middle;
}
</style>
