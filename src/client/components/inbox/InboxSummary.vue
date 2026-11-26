<script setup lang="ts">
import { computed } from 'vue'

import { INBOX_KINDS, type InboxCounts } from '#core/inbox/inboxItem.ts'
import BaseButton from '@/components/common/BaseButton.vue'
import ListSummary from '@/components/list/ListSummary.vue'
import { countOf, formatCount } from '@/format/count'

const props = defineProps<{
  counts: InboxCounts
  checkedCount: number
  /** Items the mark button marks, the checked ones or the cursor item */
  seenCount: number
}>()

defineEmits<{ markSeen: [] }>()

const NOUNS = {
  proposal: ['proposal', 'proposals'],
  reopened: ['re-opened', 're-opened'],
  expiring: ['expiring', 'expiring'],
  kev: ['new KEV', 'new KEV'],
} as const

const parts = computed(() =>
  INBOX_KINDS.filter((kind) => props.counts[kind] > 0).map((kind) => {
    const [singular, plural] = NOUNS[kind]

    return `${formatCount(props.counts[kind])} ${props.counts[kind] === 1 ? singular : plural}`
  }),
)
</script>

<template>
  <ListSummary>
    <span>{{ countOf(counts.total, 'item') }}</span>
    <span v-for="part in parts" :key="part"> · {{ part }}</span>
    <span v-if="checkedCount > 0" class="checked">
      · {{ checkedCount }} selected<span class="shortcut">, <kbd>s</kbd> to mark as seen</span>
    </span>
    <template #actions>
      <BaseButton v-if="seenCount > 0" variant="ghost" @click="$emit('markSeen')">
        {{ seenCount === 1 ? 'Mark as seen' : `Mark ${seenCount} as seen` }}
      </BaseButton>
    </template>
  </ListSummary>
</template>

<style scoped>
.checked {
  color: var(--color-text-muted);
}

kbd {
  font-size: var(--font-size-xs);
}

@media (hover: none) and (pointer: coarse) {
  .shortcut {
    display: none;
  }
}
</style>
