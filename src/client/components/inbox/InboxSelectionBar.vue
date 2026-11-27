<script setup lang="ts">
import BlockableButton from '@/components/common/BlockableButton.vue'
import SelectionBar from '@/components/list/SelectionBar.vue'
import type { HintActionId } from '@/keyboard/hintActions'
import { useHintActionsStore } from '@/stores/hintActionsStore'

defineProps<{
  /** Checked rows, the bar shows from one */
  count: number
}>()

defineEmits<{ clear: [] }>()

const actions = useHintActionsStore()

const ACTIONS: { id: HintActionId; label: string }[] = [
  { id: 'accept', label: 'Accept' },
  { id: 'reject', label: 'Reject' },
  { id: 'markSeen', label: 'Mark seen' },
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
    <BlockableButton
      v-for="action in ACTIONS"
      :key="action.id"
      class="action"
      :blocked-by="actions.reasonOf(action.id)"
      blocked-title="Not available"
      @press="runAction(action.id)"
    >
      {{ action.label }}
    </BlockableButton>
  </SelectionBar>
</template>

<style scoped src="@/components/list/selectionAction.css"></style>
