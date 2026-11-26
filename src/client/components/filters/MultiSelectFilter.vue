<script setup lang="ts" generic="T extends string">
import {
  CheckboxGroupRoot,
  CheckboxIndicator,
  CheckboxRoot,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import { computed } from 'vue'

import type { FilterOption } from '@/components/filters/filterOption'

const props = defineProps<{
  label: string
  options: FilterOption<T>[]
}>()

const model = defineModel<T[]>({ required: true })

const summary = computed(() => {
  if (model.value.length === 0) {
    return null
  }

  if (model.value.length === 1) {
    return props.options.find((option) => option.value === model.value[0])?.label ?? null
  }

  return String(model.value.length)
})

/**
 * Stores the checked values in the order of the options.
 * @param {unknown[]} values - Checked values from the checkbox group
 * @returns {void}
 */
const onUpdate = (values: unknown[]): void => {
  model.value = props.options
    .map((option) => option.value)
    .filter((value) => values.includes(value))
}
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger class="trigger" :class="{ active: summary !== null }">
      {{ label }}
      <span v-if="summary !== null" class="summary">{{ summary }}</span>
      <svg class="caret" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M4.5 6.5 8 10l3.5-3.5" />
      </svg>
    </PopoverTrigger>
    <PopoverPortal>
      <!-- as-child renders the surface from this template, Reka moves class attrs off its scoped root -->
      <PopoverContent
        as-child
        align="start"
        :side-offset="4"
        :collision-padding="8"
        :aria-label="label"
      >
        <div class="content">
          <CheckboxGroupRoot class="group" :model-value="model" @update:model-value="onUpdate">
            <label v-for="option in options" :key="option.value" class="option">
              <CheckboxRoot class="checkbox" :value="option.value">
                <CheckboxIndicator class="indicator">
                  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                  </svg>
                </CheckboxIndicator>
              </CheckboxRoot>
              {{ option.label }}
            </label>
          </CheckboxGroupRoot>
          <button v-if="model.length > 0" type="button" class="clear" @click="model = []">
            Clear
          </button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style scoped>
.trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  height: var(--control-height);
  padding: 0 var(--space-2);
  border: var(--border-width) dashed var(--color-border-strong);
  border-radius: var(--radius);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.trigger:hover,
.trigger[aria-expanded='true'] {
  background: var(--color-hover);
  color: var(--color-text);
}

.active {
  border-style: solid;
  color: var(--color-text);
}

.summary {
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--color-selected);
  font-weight: var(--font-weight-medium);
}

.caret {
  width: var(--icon-size);
  height: var(--icon-size);
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.content {
  z-index: var(--z-menu);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: var(--popover-min-width);
  max-width: calc(100vw - 2 * var(--space-2));
  padding: var(--space-1);
  border-radius: var(--radius);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-md);
  color: var(--color-text);
}

.group {
  display: flex;
  flex-direction: column;
}

.option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: var(--control-height);
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.option:hover {
  background: var(--color-hover);
}

.checkbox {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: var(--checkbox-size);
  height: var(--checkbox-size);
  padding: 0;
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.checkbox[aria-checked='true'] {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.indicator {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
}

.indicator svg {
  display: block;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.clear {
  align-self: flex-start;
  padding: var(--space-1) var(--space-2);
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.clear:hover {
  color: var(--color-text);
}
</style>
