<script setup lang="ts">
import type { InboxBulkCounts } from '@/components/inbox/inboxBulkCounts'
import BulkActionButton from '@/components/list/BulkActionButton.vue'
import SelectionBar from '@/components/list/SelectionBar.vue'
import type { BulkNoun } from '@/format/bulkCount'
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

const ACTIONS: { id: HintActionId & keyof InboxBulkCounts; label: string; noun: BulkNoun }[] = [
  { id: 'accept', label: 'Accept', noun: { singular: 'proposal' } },
  { id: 'reject', label: 'Reject', noun: { singular: 'proposal' } },
  { id: 'markSeen', label: 'Mark seen', noun: { singular: 'item' } },
]

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
      class="action"
      :label="action.label"
      :count="counts[action.id]"
      :noun="action.noun"
      :blocked-by="actions.reasonOf(action.id)"
      blocked-title="Not available"
      @press="runAction(action.id)"
    />
  </SelectionBar>
</template>

<style scoped src="@/components/list/selectionAction.css"></style>
