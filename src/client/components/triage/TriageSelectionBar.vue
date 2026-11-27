<script setup lang="ts">
import { computed } from 'vue'

import SelectionAutoCheckButton from '@/components/checks/SelectionAutoCheckButton.vue'
import BlockableButton from '@/components/common/BlockableButton.vue'
import { useSelectionHandoffButtons } from '@/composables/useSelectionHandoffButtons'
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

const ACTIONS: { id: HintActionId; label: string }[] = [
  { id: 'accept', label: 'Accept' },
  { id: 'notAffected', label: 'Not affected' },
  { id: 'fixPlanned', label: 'Fix planned' },
]

const BLOCKED_TITLE = 'Not available'

const label = computed(() => `${props.count} selected`)

/**
 * Runs a hint action as its key does, leaving focus on the bar so a tap does not scroll the
 * list back to the keyboard cursor.
 * @param {HintActionId} id - Action id
 * @returns {void}
 */
const runAction = (id: HintActionId): void => {
  void actions.run(id, false)
}

/**
 * Moves focus between the buttons of the toolbar with the horizontal arrow keys.
 * @param {KeyboardEvent} event - Keydown inside the toolbar
 * @returns {void}
 */
const onKeydown = (event: KeyboardEvent): void => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
    return
  }

  const toolbar = event.currentTarget as HTMLElement
  const buttons = [...toolbar.querySelectorAll<HTMLButtonElement>('button')]
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const step = event.key === 'ArrowRight' ? 1 : -1

  event.preventDefault()
  buttons[(index + step + buttons.length) % buttons.length]?.focus()
}
</script>

<template>
  <div
    v-if="count > 0"
    class="selection-bar"
    data-sticky-edge="bottom"
    role="toolbar"
    :aria-label="`${label}, selection actions`"
    @keydown="onKeydown"
  >
    <span class="count">{{ label }}</span>
    <div class="manage">
      <BlockableButton
        class="action"
        :blocked-by="actions.reasonOf('selectAll')"
        :blocked-title="BLOCKED_TITLE"
        @press="runAction('selectAll')"
      >
        Select all
      </BlockableButton>
      <button type="button" class="action" @click="$emit('clear')">Clear</button>
    </div>
    <div class="bulk scroll-row">
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
    </div>
  </div>
</template>

<style scoped src="@/components/layout/scrollRow.css"></style>

<style scoped>
.selection-bar {
  position: sticky;
  bottom: var(--nav-inset);
  z-index: var(--z-sticky);
  display: none;
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3) calc(var(--space-2) + env(safe-area-inset-bottom, 0px));
  border-top: var(--border-width) solid var(--color-border);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-md);
}

.count {
  flex: none;
  margin-right: auto;
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
}

.manage,
.decide {
  display: flex;
  flex: none;
  gap: var(--space-2);
}

/* bulk actions stay one line and scroll sideways, the count and the selection controls stay put */
.bulk {
  flex: 0 1 auto;
}

.bulk > * {
  flex: none;
}

.action {
  min-width: var(--touch-target);
  min-height: var(--touch-target);
  padding: 0 var(--space-3);
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  transition: background-color var(--duration-fast) var(--ease);
}

.action:hover:not([aria-disabled='true']) {
  background: var(--color-hover);
}

.action[aria-disabled='true'] {
  color: var(--color-text-subtle);
  cursor: default;
}

@media (max-width: 899px), (hover: none) and (pointer: coarse) {
  .selection-bar {
    display: flex;
  }
}

/* bottom navigation shown, its inset already holds the safe area */
@media (max-width: 899px) {
  .selection-bar {
    padding-bottom: var(--space-2);
  }
}

/* own line below the count, buttons share its width while they fit */
@media (max-width: 639px) {
  .selection-bar {
    flex-wrap: wrap;
  }

  .bulk {
    flex: 1 1 100%;
  }

  .bulk > *,
  .decision {
    flex: 1 0 auto;
  }
}
</style>
