<script setup lang="ts">
import { WAITING_FOR_MAX_LENGTH } from '#core/decision.ts'
import FieldErrors from '@/components/decision/FieldErrors.vue'

const props = defineProps<{
  /** Prefix of the control and error ids */
  fieldId: string
  errors: string[]
}>()

const upstreamPending = defineModel<boolean>('upstreamPending', { required: true })
const waitingFor = defineModel<string>('waitingFor', { required: true })

const inputId = `${props.fieldId}-waiting-for`
const errorId = `${props.fieldId}-waiting-for-error`
</script>

<template>
  <div class="field">
    <label class="check">
      <input v-model="upstreamPending" type="checkbox" name="upstreamPending" />
      Waiting for upstream
    </label>
    <template v-if="upstreamPending">
      <label :for="inputId" class="label">Waiting for</label>
      <input
        :id="inputId"
        v-model="waitingFor"
        class="waiting-for"
        type="text"
        required
        :maxlength="WAITING_FOR_MAX_LENGTH"
        :aria-invalid="errors.length > 0 || undefined"
        :aria-describedby="errors.length > 0 ? errorId : undefined"
        placeholder="Release or image that will ship the fix"
      />
      <FieldErrors :id="errorId" :messages="errors" />
      <p class="note">No fix is published yet. Set the expiry to the date to look again.</p>
    </template>
  </div>
</template>

<style scoped src="@/components/decision/decisionField.css"></style>

<style scoped>
.check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  font-weight: var(--font-weight-medium);
}

.check input {
  margin: 0;
  accent-color: var(--color-accent);
}

.waiting-for {
  height: var(--control-height);
  padding: 0 var(--space-2);
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.waiting-for[aria-invalid='true'] {
  border-color: var(--color-danger);
}

.note {
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
}
</style>
