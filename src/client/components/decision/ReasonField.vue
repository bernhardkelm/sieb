<script setup lang="ts">
import { ref } from 'vue'

import type { DecisionStatus } from '#core/decision.ts'
import FieldErrors from '@/components/decision/FieldErrors.vue'
import { reasonPlaceholder, TEXT_MAX_LENGTH } from '@/components/decision/decisionFormModel'

const props = defineProps<{
  /** Prefix of the input and error ids */
  fieldId: string
  /** Chosen status, picks the placeholder */
  status: DecisionStatus | null
  errors: string[]
}>()

const reason = defineModel<string>({ required: true })
const input = ref<HTMLTextAreaElement | null>(null)

/**
 * Focuses the reason input.
 * @returns {void}
 */
const focus = (): void => {
  input.value?.focus()
}

defineExpose({ focus })

const inputId = `${props.fieldId}-reason`
const errorId = `${props.fieldId}-reason-error`
</script>

<template>
  <div class="field">
    <label :for="inputId" class="label">Reason</label>
    <textarea
      :id="inputId"
      ref="input"
      v-model="reason"
      class="reason"
      required
      :maxlength="TEXT_MAX_LENGTH"
      :aria-invalid="errors.length > 0 || undefined"
      :aria-describedby="errors.length > 0 ? errorId : undefined"
      :placeholder="reasonPlaceholder(status)"
    />
    <FieldErrors :id="errorId" :messages="errors" />
  </div>
</template>

<style scoped src="@/components/decision/decisionField.css"></style>

<style scoped>
.reason {
  min-height: var(--textarea-min-height);
  padding: var(--space-2);
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius);
  background: var(--color-surface);
  resize: vertical;
}

.reason[aria-invalid='true'] {
  border-color: var(--color-danger);
}
</style>
