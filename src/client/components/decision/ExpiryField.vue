<script setup lang="ts">
import { computed } from 'vue'

import { toDateInput } from '@/components/decision/decisionFormModel'
import { useNow } from '@/composables/useNow'

defineProps<{
  /** Id of the date input, the form label points at it */
  inputId: string
  /** Id of the error message, linked as description while invalid */
  errorId?: string
  invalid?: boolean
}>()

const date = defineModel<string>('date', { required: true })
const never = defineModel<boolean>('never', { required: true })

const emit = defineEmits<{ touch: [] }>()

const now = useNow()

const today = computed(() => toDateInput(now.value.toISOString()))

/**
 * Switches between no expiry and a date.
 * @param {Event} event - Change event of the checkbox
 * @returns {void}
 */
const onNever = (event: Event): void => {
  never.value = (event.target as HTMLInputElement).checked
  emit('touch')
}

/**
 * Stores a typed date.
 * @param {Event} event - Input event of the date input
 * @returns {void}
 */
const onDate = (event: Event): void => {
  date.value = (event.target as HTMLInputElement).value
  emit('touch')
}
</script>

<template>
  <div class="expiry-field">
    <input
      :id="inputId"
      type="date"
      class="date"
      :value="date"
      :min="today"
      :disabled="never"
      :aria-invalid="invalid || undefined"
      :aria-describedby="invalid ? errorId : undefined"
      @input="onDate"
    />
    <label class="never">
      <input type="checkbox" name="never-expires" :checked="never" @change="onNever" />
      Never expires
    </label>
  </div>
</template>

<style scoped>
.expiry-field {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.date {
  height: var(--control-height);
  padding: 0 var(--space-2);
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius);
  background: var(--color-surface);
  font-variant-numeric: tabular-nums;
}

.date:disabled {
  color: var(--color-text-subtle);
}

.date[aria-invalid='true'] {
  border-color: var(--color-danger);
}

.never {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  color: var(--color-text-muted);
}

.never input {
  margin: 0;
  accent-color: var(--color-accent);
}
</style>
