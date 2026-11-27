<script setup lang="ts">
import { computed } from 'vue'

import SelectionAutoCheckButton from '@/components/checks/SelectionAutoCheckButton.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BulkActionButton from '@/components/list/BulkActionButton.vue'
import ListSummary from '@/components/list/ListSummary.vue'
import { useSelectionAutoCheckLabel } from '@/composables/useSelectionAutoCheckLabel'
import { allOf, FINDING_NOUN } from '@/format/bulkCount'

const props = defineProps<{
  shown: number
  total: number
  /** Shown findings first seen within the last seven days that the user has not seen */
  newCount: number
  checkedCount: number
  /** Active custom sort, null for the triage order */
  sortLabel: string | null
}>()

defineEmits<{ bulk: []; resetSort: []; markSeen: [] }>()

const autoCheck = useSelectionAutoCheckLabel()
const decided = computed(() => allOf(props.checkedCount))
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
      <BaseButton v-if="newCount > 0" variant="ghost" @click="$emit('markSeen')">
        Mark all as seen
      </BaseButton>
      <BulkActionButton
        v-if="checkedCount > 0"
        :as="BaseButton"
        class="bulk-button"
        variant="ghost"
        label="Decide"
        :count="decided"
        :noun="FINDING_NOUN"
        :blocked-by="null"
        blocked-title="Not available"
        @press="$emit('bulk')"
      />
      <SelectionAutoCheckButton
        v-if="checkedCount > 0"
        :as="BaseButton"
        class="bulk-button"
        variant="ghost"
        v-bind="autoCheck.attrs.value"
      >
        {{ autoCheck.text.value }}
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
