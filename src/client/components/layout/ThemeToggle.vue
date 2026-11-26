<script setup lang="ts">
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'

import HintTooltip from '@/components/common/HintTooltip.vue'
import ThemeIcon from '@/components/layout/ThemeIcon.vue'
import { useTheme, type ThemeChoice } from '@/composables/useTheme'

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'auto', label: 'System' },
  { value: 'dark', label: 'Dark' },
]

const { theme, setTheme } = useTheme()

/**
 * Applies a selected theme; a click on the active item deselects in Reka, which keeps the choice.
 * @param {unknown} value - Selected value, undefined when the active item was clicked again
 * @returns {void}
 */
const onSelect = (value: unknown): void => {
  const option = OPTIONS.find((candidate) => candidate.value === value)

  if (option) {
    setTheme(option.value)
  }
}
</script>

<template>
  <ToggleGroupRoot
    class="theme-toggle"
    type="single"
    aria-label="Theme"
    :model-value="theme"
    @update:model-value="onSelect"
  >
    <HintTooltip v-for="option in OPTIONS" :key="option.value" :text="`${option.label} theme`">
      <ToggleGroupItem class="item" :value="option.value" :aria-label="`${option.label} theme`">
        <ThemeIcon :choice="option.value" />
      </ToggleGroupItem>
    </HintTooltip>
  </ToggleGroupRoot>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  padding: var(--space-0-5);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.item {
  display: inline-grid;
  place-items: center;
  width: calc(var(--control-height) - var(--space-1));
  height: calc(var(--control-height) - var(--space-1) - 2 * var(--border-width));
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
}

.item:hover {
  color: var(--color-text);
}

.item[aria-pressed='true'] {
  background: var(--color-hover);
  color: var(--color-text);
}
</style>
