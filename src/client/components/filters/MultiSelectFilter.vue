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

import AppIcon from '@/components/icons/AppIcon.vue'
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
    <PopoverTrigger class="menu-trigger trigger" :class="{ active: summary !== null }">
      {{ label }}
      <span v-if="summary !== null" class="menu-summary">{{ summary }}</span>
      <AppIcon class="caret" name="chevron-down" />
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
        <div class="menu-content content">
          <CheckboxGroupRoot class="group" :model-value="model" @update:model-value="onUpdate">
            <label v-for="option in options" :key="option.value" class="option">
              <CheckboxRoot class="checkbox" :value="option.value">
                <CheckboxIndicator class="indicator">
                  <AppIcon class="check-icon" name="check" />
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

<style scoped src="@/components/filters/menuPopover.css"></style>

<style scoped>
.trigger {
  display: inline-flex;
}

.content {
  gap: var(--space-1);
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

.check-icon {
  --icon-size: 100%;
  --icon-stroke: var(--icon-stroke-bold);

  display: block;
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
