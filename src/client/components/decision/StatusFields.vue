<script setup lang="ts">
import { ref } from 'vue'

import {
  DECISION_STATUSES,
  JUSTIFIABLE_STATUS,
  type DecisionJustification,
  type DecisionStatus,
} from '#core/decision.ts'
import FieldErrors from '@/components/decision/FieldErrors.vue'
import JustificationField from '@/components/decision/JustificationField.vue'
import RadioChoice from '@/components/decision/RadioChoice.vue'
import { STATUS_LABELS } from '@/format/labels'

const props = defineProps<{
  /** Prefix of the control and error ids */
  fieldId: string
  statusErrors: string[]
  justificationErrors: string[]
}>()

const status = defineModel<DecisionStatus | null>('status', { required: true })
const justification = defineModel<DecisionJustification | null>('justification', {
  required: true,
})
const statusChoice = ref<{ focus: () => void } | null>(null)

const STATUS_OPTIONS = DECISION_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))
const statusErrorId = `${props.fieldId}-status-error`
const justificationId = `${props.fieldId}-justification`
const justificationErrorId = `${props.fieldId}-justification-error`

/**
 * Focuses the checked status, the first one while none is checked.
 * @returns {void}
 */
const focus = (): void => {
  statusChoice.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="field">
    <span class="label">Status</span>
    <RadioChoice
      ref="statusChoice"
      v-model="status"
      label="Status"
      :options="STATUS_OPTIONS"
      :aria-invalid="statusErrors.length > 0 || undefined"
      :aria-describedby="statusErrors.length > 0 ? statusErrorId : undefined"
    />
    <FieldErrors :id="statusErrorId" :messages="statusErrors" />
  </div>
  <div v-if="status === JUSTIFIABLE_STATUS" class="field">
    <label :for="justificationId" class="label">Justification (optional)</label>
    <JustificationField
      v-model="justification"
      :trigger-id="justificationId"
      :error-id="justificationErrorId"
      :invalid="justificationErrors.length > 0"
    />
    <FieldErrors :id="justificationErrorId" :messages="justificationErrors" />
  </div>
</template>

<style scoped src="@/components/decision/decisionField.css"></style>
