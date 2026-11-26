<script setup lang="ts">
import { computed } from 'vue'
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

const current = computed(
  () => OPTIONS.find((option) => option.value === theme.value) ?? OPTIONS[1]!,
)
const next = computed(() => OPTIONS[(OPTIONS.indexOf(current.value) + 1) % OPTIONS.length]!)

/**
 * Switches to the next theme of the cycle, used by the compact button.
 * @returns {void}
 */
const cycle = (): void => {
  setTheme(next.value.value)
}

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
  <HintTooltip :text="`${current.label} theme, switch to ${next.label}`">
    <button
      class="theme-cycle"
      type="button"
      :aria-label="`Theme: ${current.label}, switch to ${next.label}`"
      @click="cycle"
    >
      <ThemeIcon :choice="current.value" />
    </button>
  </HintTooltip>
</template>

<style scoped>
.theme-cycle {
  display: none;
  place-items: center;
  width: var(--control-height);
  height: var(--control-height);
  padding: 0;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text-muted);
}

.theme-cycle:hover {
  color: var(--color-text);
}

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

@media (max-width: 639px) {
  .theme-toggle {
    display: none;
  }

  .theme-cycle {
    display: inline-grid;
  }
}
</style>
