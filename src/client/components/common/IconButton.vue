<script setup lang="ts">
import BlockableButton from '@/components/common/BlockableButton.vue'
import HintTooltip from '@/components/common/HintTooltip.vue'

defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    /** Accessible name, also the tooltip unless hint is set */
    label: string
    /** Tooltip while the action can run, longer than the label */
    hint?: string
    /** Shortcut keys shown in the tooltip */
    keys?: string[]
    /** Draws the neutral border, off for a quiet button inside a field */
    bordered?: boolean
    /** Why the action cannot run now, null while it can */
    blockedBy?: string | null
    /** Toast title naming the reason when a blocked button is pressed */
    blockedTitle?: string
    /** Marks a request in flight */
    busy?: boolean
  }>(),
  {
    hint: undefined,
    keys: () => [],
    bordered: true,
    blockedBy: null,
    blockedTitle: 'Not available',
    busy: false,
  },
)

defineEmits<{ press: [] }>()
</script>

<template>
  <HintTooltip :text="blockedBy ?? hint ?? label" :keys="keys">
    <BlockableButton
      v-bind="$attrs"
      class="icon-button"
      :class="{ bordered }"
      :aria-label="label"
      :blocked-by="blockedBy"
      :blocked-title="blockedTitle"
      :busy="busy"
      untitled
      @press="$emit('press')"
    >
      <slot />
    </BlockableButton>
  </HintTooltip>
</template>

<style scoped>
.icon-button {
  display: inline-grid;
  flex: none;
  place-items: center;
  min-width: var(--control-height);
  height: var(--control-height);
  padding: 0;
  border: var(--border-width) solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  transition:
    background-color var(--duration-fast) var(--ease),
    color var(--duration-fast) var(--ease);
}

.bordered {
  border-color: var(--color-border);
}

.icon-button:hover:not([aria-disabled='true']) {
  background: var(--color-hover);
  color: var(--color-text);
}

.icon-button[aria-disabled='true'] {
  cursor: default;
  opacity: var(--opacity-disabled);
}

@media (hover: none) and (pointer: coarse), (max-width: 639px) {
  .icon-button {
    min-width: var(--touch-target);
    height: var(--touch-target);
  }
}
</style>
