<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import { DECIDE_ACTIONS, MARK_SEEN_ACTION } from '@/components/inbox/inboxBulkActions'
import type { InboxBulkCounts } from '@/components/inbox/inboxBulkCounts'
import BulkActionButton from '@/components/list/BulkActionButton.vue'
import SelectionBar from '@/components/list/SelectionBar.vue'
import type { HintActionId } from '@/keyboard/hintActions'
import { useHintActionsStore } from '@/stores/hintActionsStore'

defineProps<{
  /** Checked rows, the bar shows from one */
  count: number
  /** Checked items each action acts on */
  counts: InboxBulkCounts
}>()

defineEmits<{ clear: [] }>()

const actions = useHintActionsStore()

const ACTIONS = [...DECIDE_ACTIONS, MARK_SEEN_ACTION]

/**
 * Runs a hint action as its key does, leaving focus on the bar so a tap does not scroll the
 * list back to the keyboard cursor.
 * @param {HintActionId} id - Action id
 * @returns {void}
 */
const runAction = (id: HintActionId): void => {
  void actions.run(id, false)
}
</script>

<template>
  <SelectionBar :count="count" @clear="$emit('clear')">
    <BulkActionButton
      v-for="action in ACTIONS"
      :key="action.id"
      :as="BaseButton"
      class="action"
      size="touch"
      :label="action.label"
      :count="counts[action.id]"
      :noun="action.noun"
      :blocked-by="actions.reasonOf(action.id)"
      blocked-title="Not available"
      @press="runAction(action.id)"
    />
  </SelectionBar>
</template>
