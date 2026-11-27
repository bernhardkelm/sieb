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
import AppIcon from '@/components/icons/AppIcon.vue'
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
        <AppIcon class="caret" name="chevron-down" />
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
                <AppIcon class="check-icon" name="check" />
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

.check-icon {
  --icon-stroke: var(--icon-stroke-bold);

  color: var(--color-accent);
}
</style>
