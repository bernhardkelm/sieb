<script setup lang="ts">
import { computed } from 'vue'

import { INBOX_KINDS, type InboxCounts } from '#core/inbox/inboxItem.ts'
import BaseButton from '@/components/common/BaseButton.vue'
import BlockableButton from '@/components/common/BlockableButton.vue'
import ListSummary from '@/components/list/ListSummary.vue'
import { countOf, formatCount } from '@/format/count'
import type { HintActionId } from '@/keyboard/hintActions'
import { useHintActionsStore } from '@/stores/hintActionsStore'

const props = defineProps<{
  counts: InboxCounts
  checkedCount: number
  /** Items the mark button marks, the checked ones or the cursor item */
  seenCount: number
}>()

defineEmits<{ markSeen: [] }>()

const actions = useHintActionsStore()

const NOUNS = {
  proposal: ['proposal', 'proposals'],
  reopened: ['re-opened', 're-opened'],
  expiring: ['expiring', 'expiring'],
  kev: ['new KEV', 'new KEV'],
} as const

const BULK: { id: HintActionId; label: string }[] = [
  { id: 'accept', label: 'Accept selected' },
  { id: 'reject', label: 'Reject selected' },
]

const parts = computed(() =>
  INBOX_KINDS.filter((kind) => props.counts[kind] > 0).map((kind) => {
    const [singular, plural] = NOUNS[kind]

    return `${formatCount(props.counts[kind])} ${props.counts[kind] === 1 ? singular : plural}`
  }),
)

/**
 * Runs a bulk hint action as its key does.
 * @param {HintActionId} id - Action id
 * @returns {void}
 */
const runAction = (id: HintActionId): void => {
  void actions.run(id)
}
</script>

<template>
  <ListSummary>
    <span>{{ countOf(counts.total, 'item') }}</span>
    <span v-for="part in parts" :key="part"> · {{ part }}</span>
    <span v-if="checkedCount > 0" class="checked">
      · {{ checkedCount }} selected<span class="shortcut"
        >, <kbd>a</kbd> <kbd>d</kbd> <kbd>s</kbd> to accept, reject or mark as seen</span
      >
    </span>
    <template #actions>
      <template v-if="checkedCount > 0">
        <BlockableButton
          v-for="action in BULK"
          :key="action.id"
          :as="BaseButton"
          class="bulk-button"
          variant="ghost"
          :blocked-by="actions.reasonOf(action.id)"
          blocked-title="Not available"
          @press="runAction(action.id)"
        >
          {{ action.label }}
        </BlockableButton>
        <BlockableButton
          :as="BaseButton"
          class="bulk-button"
          variant="ghost"
          :blocked-by="actions.reasonOf('markSeen')"
          blocked-title="Not available"
          @press="$emit('markSeen')"
        >
          Mark seen
        </BlockableButton>
      </template>
      <BaseButton v-else-if="seenCount > 0" variant="ghost" @click="$emit('markSeen')">
        Mark as seen
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

.bulk-button[aria-disabled='true'] {
  color: var(--color-text-subtle);
  cursor: default;
  opacity: 0.55;
}

@media (hover: none) and (pointer: coarse) {
  .shortcut {
    display: none;
  }
}

/* the selection bar takes over in this layout */
@media (max-width: 899px), (hover: none) and (pointer: coarse) {
  .bulk-button {
    display: none;
  }
}
</style>
