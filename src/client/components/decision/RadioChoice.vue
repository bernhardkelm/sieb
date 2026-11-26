<script setup lang="ts" generic="T extends string">
import { RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { ref } from 'vue'

import type { FilterOption } from '@/components/filters/filterOption'

defineProps<{
  label: string
  options: (FilterOption<T> & { hint?: string; disabled?: boolean })[]
}>()

/** Selected value, null while none is chosen */
const model = defineModel<T | null>({ required: true })
const root = ref<InstanceType<typeof RadioGroupRoot> | null>(null)

/**
 * Stores a selected value; Reka passes it untyped.
 * @param {unknown} value - Selected value
 * @returns {void}
 */
const onUpdate = (value: unknown): void => {
  model.value = value as T
}

/**
 * Focuses the checked option, the first enabled one while none is checked.
 * @returns {void}
 */
const focus = (): void => {
  const element = root.value?.$el as HTMLElement | undefined
  const target =
    element?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ??
    element?.querySelector<HTMLElement>('[role="radio"]:not(:disabled)')

  target?.focus()
}

defineExpose({ focus })
</script>

<template>
  <RadioGroupRoot
    ref="root"
    class="radio-choice"
    :model-value="model"
    :aria-label="label"
    orientation="horizontal"
    @update:model-value="onUpdate"
  >
    <RadioGroupItem
      v-for="option in options"
      :key="option.value"
      class="item"
      :value="option.value"
      :disabled="option.disabled"
      :title="option.hint"
    >
      <span class="radio" aria-hidden="true">
        <RadioGroupIndicator class="dot" />
      </span>
      {{ option.label }}
    </RadioGroupItem>
  </RadioGroupRoot>
</template>

<style scoped>
.radio-choice {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  height: var(--control-height);
  padding: 0 var(--space-2);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  font-size: var(--font-size-md);
}

.item:hover:not(:disabled) {
  background: var(--color-hover);
}

.item[aria-checked='true'] {
  border-color: var(--color-accent);
  background: var(--color-selected);
}

.radio-choice[aria-invalid='true'] .item:not([aria-checked='true']) {
  border-color: var(--color-danger);
}

.item:disabled {
  color: var(--color-text-subtle);
}

.radio {
  display: inline-grid;
  place-items: center;
  width: var(--checkbox-size);
  height: var(--checkbox-size);
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius-pill);
}

.item[aria-checked='true'] .radio {
  border-color: var(--color-accent);
}

.dot {
  width: var(--dot-size);
  height: var(--dot-size);
  border-radius: var(--radius-pill);
  background: var(--color-accent);
}
</style>
