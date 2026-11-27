<script setup lang="ts">
import { computed } from 'vue'

import SelectionAutoCheckButton from '@/components/checks/SelectionAutoCheckButton.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BulkActionButton from '@/components/list/BulkActionButton.vue'
import SelectionBar from '@/components/list/SelectionBar.vue'
import { useSelectionAutoCheckLabel } from '@/composables/useSelectionAutoCheckLabel'
import { useSelectionHandoffButtons } from '@/composables/useSelectionHandoffButtons'
import { allOf, FINDING_NOUN } from '@/format/bulkCount'
import { DECISION_KEYMAP } from '@/keyboard/decisionKeymap'
import type { HintActionId } from '@/keyboard/hintActions'
import { useHintActionsStore } from '@/stores/hintActionsStore'
import { useMcpStore } from '@/stores/mcpStore'

const props = defineProps<{
  /** Checked rows, the bar shows from one */
  count: number
}>()

defineEmits<{ clear: [] }>()

const actions = useHintActionsStore()
const mcp = useMcpStore()
const handoff = useSelectionHandoffButtons()
const autoCheck = useSelectionAutoCheckLabel()
const decided = computed(() => allOf(props.count))

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
      <BulkActionButton
        v-for="action in DECISION_KEYMAP"
        :key="action.action"
        :as="BaseButton"
        class="action decision"
        size="touch"
        :label="action.label"
        :count="decided"
        :noun="FINDING_NOUN"
        :blocked-by="actions.reasonOf(action.action)"
        :blocked-title="BLOCKED_TITLE"
        @press="runAction(action.action)"
      />
    </div>
    <SelectionAutoCheckButton
      :as="BaseButton"
      class="action auto-check"
      size="touch"
      v-bind="autoCheck.attrs.value"
    >
      {{ autoCheck.text.value }}
    </SelectionAutoCheckButton>
    <template v-if="mcp.enabled">
      <BulkActionButton
        v-for="button in handoff.buttons.value"
        :key="button.kind"
        :as="BaseButton"
        class="action"
        size="touch"
        :label="button.label"
        :template="button.template"
        :count="button.count"
        :noun="FINDING_NOUN"
        :blocked-by="button.blockedBy"
        blocked-title="Not handed off"
        :aria-keyshortcuts="button.shortcut"
        @press="handoff.press(button.kind)"
      />
    </template>
  </SelectionBar>
</template>

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
