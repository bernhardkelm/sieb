<script setup lang="ts">
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'

import { DECISION_JUSTIFICATIONS, type DecisionJustification } from '#core/decision.ts'
import { JUSTIFICATION_LABELS } from '@/format/labels'

defineProps<{
  /** Id of the trigger button, for the label of the field */
  triggerId: string
  /** Id of the element listing the errors, described while invalid */
  errorId: string
  invalid?: boolean
}>()

const model = defineModel<DecisionJustification | null>({ required: true })

const NONE = 'none'
const NONE_LABEL = 'No justification'

const OPTIONS = [
  { value: NONE, label: NONE_LABEL },
  ...DECISION_JUSTIFICATIONS.map((value) => ({ value, label: JUSTIFICATION_LABELS[value] })),
]

/**
 * Stores a picked option, the none entry as null; Reka passes it untyped.
 * @param {unknown} value - Picked option value
 * @returns {void}
 */
const onUpdate = (value: unknown): void => {
  model.value = DECISION_JUSTIFICATIONS.find((justification) => justification === value) ?? null
}
</script>

<template>
  <SelectRoot :model-value="model ?? NONE" @update:model-value="onUpdate">
    <SelectTrigger
      :id="triggerId"
      class="trigger"
      :aria-invalid="invalid || undefined"
      :aria-describedby="invalid ? errorId : undefined"
    >
      <SelectValue class="value">{{
        model ? JUSTIFICATION_LABELS[model] : NONE_LABEL
      }}</SelectValue>
      <SelectIcon as-child>
        <svg class="caret" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M4.5 6.5 8 10l3.5-3.5" />
        </svg>
      </SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <!-- as-child renders the surface from this template, Reka moves class attrs off its scoped root -->
      <SelectContent as-child position="popper" :side-offset="4" :collision-padding="8">
        <div class="content">
          <SelectViewport>
            <SelectItem
              v-for="option in OPTIONS"
              :key="option.value"
              :value="option.value"
              class="item"
            >
              <SelectItemIndicator class="check" force-mount>
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                </svg>
              </SelectItemIndicator>
              <SelectItemText>{{ option.label }}</SelectItemText>
            </SelectItem>
          </SelectViewport>
        </div>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<style scoped>
.trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  height: var(--control-height);
  padding: 0 var(--space-2);
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-md);
  text-align: left;
}

.trigger:hover {
  background: var(--color-hover);
}

.trigger[aria-invalid='true'] {
  border-color: var(--color-danger);
}

.value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.caret {
  flex: none;
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
  min-width: var(--reka-select-trigger-width);
  max-width: calc(100vw - 2 * var(--space-2));
  max-height: var(--reka-select-content-available-height);
  padding: var(--space-1);
  overflow-y: auto;
  border-radius: var(--radius);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-md);
  color: var(--color-text);
}

.item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch-target);
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
  outline: none;
  cursor: pointer;
}

.item[data-highlighted] {
  background: var(--color-hover);
}

.check {
  display: inline-grid;
  flex: none;
  width: var(--icon-size);
  height: var(--icon-size);
  visibility: hidden;
}

.check[data-state='checked'] {
  visibility: visible;
}

.check svg {
  width: var(--icon-size);
  height: var(--icon-size);
  fill: none;
  stroke: var(--color-accent);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
