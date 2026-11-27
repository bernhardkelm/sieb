<script setup lang="ts">
import { computed, ref, useId, useSlots } from 'vue'

import FieldErrors from '@/components/decision/FieldErrors.vue'

const props = withDefaults(
  defineProps<{
    label: string
    /** Messages shown below the input, a non-empty list marks it invalid */
    errors?: string[]
    /** Help text below the input, read with it by screen readers */
    hint?: string
    type?: 'text' | 'password'
    autocomplete?: string
    placeholder?: string
    /** Sets the value in the monospace font, for hosts, paths and tokens */
    mono?: boolean
    required?: boolean
    maxlength?: number
    /** Marks the input invalid for a message shown elsewhere, such as below a field group */
    invalid?: boolean
  }>(),
  {
    errors: () => [],
    hint: undefined,
    type: 'text',
    autocomplete: 'off',
    placeholder: undefined,
    mono: false,
    required: false,
    invalid: false,
    maxlength: undefined,
  },
)

const model = defineModel<string>({ required: true })

const id = useId()
const slots = useSlots()
const hasHint = computed(() => props.hint !== undefined || slots.hint !== undefined)
const input = ref<HTMLInputElement | null>(null)
const describedBy = computed(() => {
  const ids = [hasHint.value ? `${id}-hint` : null, props.errors.length > 0 ? `${id}-error` : null]

  return ids.filter((value) => value !== null).join(' ') || undefined
})

/**
 * Focuses the input.
 * @returns {void}
 */
const focus = (): void => {
  input.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="text-field">
    <label :for="id" class="label">{{ label }}</label>
    <input
      :id="id"
      ref="input"
      v-model="model"
      class="input"
      :class="{ mono }"
      :type="type"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :maxlength="maxlength"
      :required="required || undefined"
      spellcheck="false"
      :aria-invalid="errors.length > 0 || invalid || undefined"
      :aria-describedby="describedBy"
    />
    <p v-if="hasHint" :id="`${id}-hint`" class="hint">
      <slot name="hint">{{ hint }}</slot>
    </p>
    <FieldErrors :id="`${id}-error`" :messages="errors" />
  </div>
</template>

<style scoped>
.text-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.label {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.input {
  height: var(--control-height);
  min-width: 0;
  padding: 0 var(--space-2);
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.input[aria-invalid='true'] {
  border-color: var(--color-danger);
}

.mono {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}

.hint {
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
}
</style>
