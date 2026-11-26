<script setup lang="ts">
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
      · {{ checkedCount }} selected<span class="shortcut">, <kbd>⇧A</kbd> to decide together</span>
    </span>
    <template #actions>
      <BaseButton v-if="checkedCount > 0" variant="ghost" @click="$emit('bulk')">
        Decide {{ checkedCount }} selected
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
