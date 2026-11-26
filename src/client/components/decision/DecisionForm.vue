<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'

import type { DecisionStatus } from '#core/decision.ts'
import DecisionEffectNote from '@/components/decision/DecisionEffectNote.vue'
import DecisionFormActions from '@/components/decision/DecisionFormActions.vue'
import ExpiryField from '@/components/decision/ExpiryField.vue'
import FieldErrors from '@/components/decision/FieldErrors.vue'
import RadioChoice from '@/components/decision/RadioChoice.vue'
import ReasonField from '@/components/decision/ReasonField.vue'
import ReconfirmField from '@/components/decision/ReconfirmField.vue'
import StatusFields from '@/components/decision/StatusFields.vue'
import type {
  DecisionFormInitial,
  DecisionFormValue,
} from '@/components/decision/decisionFormModel'
import { useDecisionFormErrors } from '@/composables/useDecisionFormErrors'
import { useDecisionFormFields } from '@/composables/useDecisionFormFields'
import { useDecisionFormSubmit } from '@/composables/useDecisionFormSubmit'

const props = withDefaults(
  defineProps<{
    initial?: DecisionFormInitial
    /** Offers this image versus all images; without it the scope of `initial` is submitted */
    scopeChoice?: boolean
    /** Short image name shown in the scope choice */
    imageLabel?: string
    /** Failure of the last save, ApiError validation errors are shown per field */
    error?: unknown
    submitting?: boolean
    submitLabel?: string
    /** Offers to re-confirm, for editing a re-opened decision */
    reconfirmable?: boolean
    /** Keeps Save and Cancel visible at the bottom of the surrounding scroll container */
    stickyActions?: boolean
  }>(),
  {
    initial: () => ({}),
    scopeChoice: true,
    imageLabel: 'this image',
    submitting: false,
    submitLabel: 'Save decision',
    reconfirmable: false,
    stickyActions: false,
  },
)

const emit = defineEmits<{ submit: [value: DecisionFormValue]; cancel: []; dirty: [boolean] }>()

const id = useId()
const reasonField = ref<{ focus: () => void } | null>(null)
const statusFields = ref<{ focus: () => void } | null>(null)
const fields = useDecisionFormFields(props.initial)
const { status, justification, reason, scope, reconfirm, expiryDate, never } = fields
const errors = useDecisionFormErrors(fields, () => props.error)

const scopeOptions = computed(() => [
  { value: 'image' as const, label: `Only ${props.imageLabel}` },
  { value: 'all' as const, label: 'All images' },
])

/**
 * Focuses the reason input.
 * @returns {void}
 */
const focusReason = (): void => {
  reasonField.value?.focus()
}

const { submit, onKeydown } = useDecisionFormSubmit({
  fields,
  errors,
  reconfirmable: () => props.reconfirmable,
  focusStatus: () => statusFields.value?.focus(),
  focusReason,
  emitSubmit: (value) => emit('submit', value),
})

watch(
  fields.dirty,
  (value) => {
    emit('dirty', value)
  },
  { immediate: true },
)

/**
 * Selects a status, keeping the typed reason.
 * @param {DecisionStatus} next - Status
 * @returns {void}
 */
const setStatus = (next: DecisionStatus): void => {
  status.value = next
}

defineExpose({ focusReason, setStatus })
</script>

<template>
  <form class="decision-form" novalidate @submit.prevent="submit" @keydown="onKeydown">
    <StatusFields
      ref="statusFields"
      v-model:status="status"
      v-model:justification="justification"
      :field-id="id"
      :status-errors="errors.status.value"
      :justification-errors="errors.server.value.justification"
    />
    <ReasonField
      ref="reasonField"
      v-model="reason"
      :field-id="id"
      :status="status"
      :errors="errors.reason.value"
    />
    <div v-if="scopeChoice" class="field">
      <span class="label">Scope</span>
      <RadioChoice v-model="scope" label="Scope" :options="scopeOptions" />
    </div>
    <div class="field">
      <label :for="`${id}-expiry`" class="label">Expires</label>
      <ExpiryField
        v-model:date="expiryDate"
        v-model:never="never"
        :input-id="`${id}-expiry`"
        :error-id="`${id}-expiry-error`"
        :invalid="errors.expiresAt.value.length > 0"
        @touch="fields.expiryTouched.value = true"
      />
      <FieldErrors :id="`${id}-expiry-error`" :messages="errors.expiresAt.value" />
    </div>
    <ReconfirmField v-if="reconfirmable" v-model="reconfirm" />
    <DecisionEffectNote :status="status" />
    <FieldErrors :messages="errors.server.value.general" role="alert" />
    <DecisionFormActions
      :submitting="submitting"
      :submit-label="submitLabel"
      :sticky="stickyActions"
      @cancel="emit('cancel')"
    />
  </form>
</template>

<style scoped src="@/components/decision/decisionField.css"></style>

<style scoped>
.decision-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
</style>
