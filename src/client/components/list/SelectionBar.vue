<script setup lang="ts">
import { computed } from 'vue'

import BlockableButton from '@/components/common/BlockableButton.vue'
import { useHintActionsStore } from '@/stores/hintActionsStore'

const props = defineProps<{
  /** Checked rows, the bar shows from one */
  count: number
}>()

defineEmits<{ clear: [] }>()

const actions = useHintActionsStore()

const BLOCKED_TITLE = 'Not available'

const label = computed(() => `${props.count} selected`)

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
        @press="actions.run('selectAll', false)"
      >
        Select all
      </BlockableButton>
      <button type="button" class="action" @click="$emit('clear')">Clear</button>
    </div>
    <div class="bulk scroll-row">
      <slot />
    </div>
  </div>
</template>

<style scoped src="@/components/layout/scrollRow.css"></style>
<style scoped src="@/components/list/selectionAction.css"></style>

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

.manage {
  display: flex;
  flex: none;
  gap: var(--space-2);
}

/* bulk actions stay one line and scroll sideways, the count and the selection controls stay put */
.bulk {
  flex: 0 1 auto;
}

.bulk > :slotted(*) {
  flex: none;
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

  .bulk > :slotted(*) {
    flex: 1 0 auto;
  }
}
</style>
