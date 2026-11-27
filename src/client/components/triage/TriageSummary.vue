<script setup lang="ts">
import SelectionAutoCheckButton from '@/components/checks/SelectionAutoCheckButton.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import ListSummary from '@/components/list/ListSummary.vue'

defineProps<{
  shown: number
  total: number
  /** Shown findings first seen within the last seven days */
  newCount: number
  checkedCount: number
  /** Active custom sort, null for the triage order */
  sortLabel: string | null
}>()

defineEmits<{ bulk: []; resetSort: [] }>()
</script>

<template>
  <ListSummary :sort-label="sortLabel" @reset-sort="$emit('resetSort')">
    <span>{{ shown === total ? `${total} to triage` : `${shown} of ${total} to triage` }}</span>
    <span v-if="newCount > 0"> · {{ newCount }} new this week</span>
    <span v-if="checkedCount > 0" class="checked">
      · {{ checkedCount }} selected<span class="shortcut"
        >, <kbd>a</kbd> <kbd>n</kbd> <kbd>f</kbd> to decide together</span
      >
    </span>
    <template #actions>
      <BaseButton
        v-if="checkedCount > 0"
        class="bulk-button"
        variant="ghost"
        @click="$emit('bulk')"
      >
        Decide {{ checkedCount }} selected
      </BaseButton>
      <SelectionAutoCheckButton
        v-if="checkedCount > 0"
        :as="BaseButton"
        class="bulk-button"
        variant="ghost"
      >
        Auto-check {{ checkedCount }} selected
      </SelectionAutoCheckButton>
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
