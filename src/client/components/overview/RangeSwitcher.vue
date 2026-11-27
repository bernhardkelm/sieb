<script setup lang="ts">
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'

import {
  isStatsRange,
  STATS_RANGE_PERIODS,
  STATS_RANGES,
  type StatsRange,
} from '#core/statsRange.ts'

defineProps<{
  range: StatsRange
}>()

const emit = defineEmits<{ select: [range: StatsRange] }>()

/**
 * Emits a selected range; a click on the active item deselects in Reka, which keeps the range.
 * @param {unknown} value - Selected value, undefined when the active item was clicked again
 * @returns {void}
 */
const onSelect = (value: unknown): void => {
  if (isStatsRange(value)) {
    emit('select', value)
  }
}
</script>

<template>
  <ToggleGroupRoot
    class="range-switcher"
    type="single"
    aria-label="History range"
    :model-value="range"
    @update:model-value="onSelect"
  >
    <ToggleGroupItem
      v-for="option in STATS_RANGES"
      :key="option"
      class="item"
      :value="option"
      :aria-label="`Last ${STATS_RANGE_PERIODS[option]}`"
    >
      {{ option }}
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>

<style scoped>
.range-switcher {
  display: inline-flex;
  gap: var(--space-0-5);
}

.item {
  min-width: var(--range-item-size, var(--chip-height));
  height: var(--range-item-size, var(--chip-height));
  padding: 0 var(--space-1);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
}

.item:hover {
  color: var(--color-text);
}

.item[aria-pressed='true'] {
  background: var(--color-hover);
  color: var(--color-text);
}
</style>
