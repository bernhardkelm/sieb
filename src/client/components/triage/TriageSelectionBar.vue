<script setup lang="ts">
import SelectionAutoCheckButton from '@/components/checks/SelectionAutoCheckButton.vue'
import BlockableButton from '@/components/common/BlockableButton.vue'
import SelectionBar from '@/components/list/SelectionBar.vue'
import { useSelectionHandoffButtons } from '@/composables/useSelectionHandoffButtons'
import type { HintActionId } from '@/keyboard/hintActions'
import { useHintActionsStore } from '@/stores/hintActionsStore'
import { useMcpStore } from '@/stores/mcpStore'

defineProps<{
  /** Checked rows, the bar shows from one */
  count: number
}>()

defineEmits<{ clear: [] }>()

const actions = useHintActionsStore()
const mcp = useMcpStore()
const handoff = useSelectionHandoffButtons()

const ACTIONS: { id: HintActionId; label: string }[] = [
  { id: 'accept', label: 'Accept' },
  { id: 'notAffected', label: 'Not affected' },
  { id: 'fixPlanned', label: 'Fix planned' },
]

const BLOCKED_TITLE = 'Not available'

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
    <div class="decide">
      <BlockableButton
        v-for="action in ACTIONS"
        :key="action.id"
        class="action decision"
        :blocked-by="actions.reasonOf(action.id)"
        :blocked-title="BLOCKED_TITLE"
        @press="runAction(action.id)"
      >
        {{ action.label }}
      </BlockableButton>
    </div>
    <SelectionAutoCheckButton class="action auto-check" />
    <template v-if="mcp.enabled">
      <BlockableButton
        v-for="button in handoff.buttons.value"
        :key="button.kind"
        class="action"
        :blocked-by="button.blockedBy"
        blocked-title="Not handed off"
        :aria-keyshortcuts="button.shortcut"
        @press="handoff.press(button.kind)"
      >
        {{ button.label }}
      </BlockableButton>
    </template>
  </SelectionBar>
</template>

<style scoped src="@/components/list/selectionAction.css"></style>

<style scoped>
.decide {
  display: flex;
  gap: var(--space-2);
}

@media (max-width: 639px) {
  .decision {
    flex: 1 0 auto;
  }
}
</style>
