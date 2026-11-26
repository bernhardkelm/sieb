<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'

import {
  DECISION_STATUSES,
  JUSTIFIABLE_STATUS,
  type DecisionJustification,
  type DecisionScope,
  type DecisionStatus,
} from '#core/decision.ts'
import BaseButton from '@/components/common/BaseButton.vue'
import KeyHint from '@/components/common/KeyHint.vue'
import ExpiryField from '@/components/decision/ExpiryField.vue'
import FieldErrors from '@/components/decision/FieldErrors.vue'
import JustificationField from '@/components/decision/JustificationField.vue'
import RadioChoice from '@/components/decision/RadioChoice.vue'
import ReconfirmField from '@/components/decision/ReconfirmField.vue'
import {
  decisionFormErrors,
  hasLocalErrors,
  localFormErrors,
  type LocalFormErrors,
} from '@/components/decision/decisionFormErrors'
import {
  defaultExpiryDate,
  fromDateInput,
  justificationFor,
  reasonPlaceholder,
  TEXT_MAX_LENGTH,
  toDateInput,
  type DecisionFormInitial,
  type DecisionFormValue,
} from '@/components/decision/decisionFormModel'
import { STATUS_LABELS } from '@/format/labels'
import { MODIFIER_KEY } from '@/keyboard/modifierKey'

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
const reasonInput = ref<HTMLTextAreaElement | null>(null)
const statusChoice = ref<{ focus: () => void } | null>(null)
const initialStatus = props.initial.status ?? null
const initialReason = props.initial.reason ?? ''
const initialScope = props.initial.scope ?? 'image'
const initialJustification = props.initial.justification ?? null
const status = ref<DecisionStatus | null>(initialStatus)
const justification = ref<DecisionJustification | null>(initialJustification)
const reason = ref(initialReason)
const scope = ref<DecisionScope>(initialScope)
const reconfirm = ref(false)
const expiryTouched = ref(false)

/**
 * Returns the date the form shows for a status while the expiry is untouched: the given expiry
 * for the starting status, the default of any other status, as the server applies it, and no
 * expiry while no status is chosen.
 * @param {DecisionStatus | null} next - Status, null for none
 * @returns {string | null} - Date as YYYY-MM-DD, null for no expiry
 */
const expiryDateFor = (next: DecisionStatus | null): string | null => {
  const given = props.initial.expiresAt

  if (next === null) {
    return null
  }

  if (given !== undefined && next === initialStatus) {
    return given === null ? null : toDateInput(given)
  }

  return defaultExpiryDate(next, new Date())
}

const initialDate = expiryDateFor(initialStatus)
const expiryDate = ref(initialDate ?? '')
const never = ref(initialDate === null)
const localErrors = ref<LocalFormErrors>({ status: [], reason: [], expiresAt: [] })
const dirty = computed(
  () =>
    reason.value.trim() !== initialReason.trim() ||
    scope.value !== initialScope ||
    justification.value !== initialJustification ||
    expiryTouched.value ||
    reconfirm.value,
)

const STATUS_OPTIONS = DECISION_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))
const scopeOptions = computed(() => [
  { value: 'image' as const, label: `Only ${props.imageLabel}` },
  { value: 'all' as const, label: 'All images' },
])

const serverErrors = computed(() => decisionFormErrors(props.error))
const statusErrors = computed(() => [...localErrors.value.status, ...serverErrors.value.status])
const reasonErrors = computed(() => [...localErrors.value.reason, ...serverErrors.value.reason])
const expiryErrors = computed(() => [
  ...localErrors.value.expiresAt,
  ...serverErrors.value.expiresAt,
])

watch(status, (next) => {
  localErrors.value.status = []

  if (!expiryTouched.value) {
    const date = expiryDateFor(next)

    never.value = date === null
    expiryDate.value = date ?? ''
  }
})

watch(reason, () => {
  localErrors.value.reason = []
})

watch([expiryDate, never], () => {
  localErrors.value.expiresAt = []
})

watch(
  dirty,
  (value) => {
    emit('dirty', value)
  },
  { immediate: true },
)

/**
 * Checks the input and emits it; a missing status, a blank reason or a missing date stops here
 * and focuses the first field in error.
 * @returns {void}
 */
const submit = (): void => {
  const expiresAt = never.value ? null : fromDateInput(expiryDate.value)
  const chosen = status.value

  localErrors.value = localFormErrors({
    status: chosen,
    reason: reason.value,
    never: never.value,
    expiresAt,
  })

  if (chosen === null || hasLocalErrors(localErrors.value)) {
    if (chosen === null) {
      statusChoice.value?.focus()
    } else if (localErrors.value.reason.length > 0) {
      reasonInput.value?.focus()
    }

    return
  }

  emit('submit', {
    status: chosen,
    justification: justificationFor(chosen, justification.value),
    reason: reason.value.trim(),
    scope: scope.value,
    expiresAt,
    expiryTouched: expiryTouched.value,
    reconfirm: props.reconfirmable && reconfirm.value,
  })
}

/**
 * Submits on Cmd+Enter or Ctrl+Enter from anywhere in the form, never on a key repeat.
 * @param {KeyboardEvent} event - Keydown event
 * @returns {void}
 */
const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()

    if (!event.repeat) {
      submit()
    }
  }
}

/**
 * Focuses the reason input.
 * @returns {void}
 */
const focusReason = (): void => {
  reasonInput.value?.focus()
}

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
    <div class="field">
      <span class="label">Status</span>
      <RadioChoice
        ref="statusChoice"
        v-model="status"
        label="Status"
        :options="STATUS_OPTIONS"
        :aria-invalid="statusErrors.length > 0 || undefined"
        :aria-describedby="statusErrors.length > 0 ? `${id}-status-error` : undefined"
      />
      <FieldErrors :id="`${id}-status-error`" :messages="statusErrors" />
    </div>
    <div v-if="status === JUSTIFIABLE_STATUS" class="field">
      <label :for="`${id}-justification`" class="label">Justification (optional)</label>
      <JustificationField
        v-model="justification"
        :trigger-id="`${id}-justification`"
        :error-id="`${id}-justification-error`"
        :invalid="serverErrors.justification.length > 0"
      />
      <FieldErrors :id="`${id}-justification-error`" :messages="serverErrors.justification" />
    </div>
    <div class="field">
      <label :for="`${id}-reason`" class="label">Reason</label>
      <textarea
        :id="`${id}-reason`"
        ref="reasonInput"
        v-model="reason"
        class="reason"
        required
        :maxlength="TEXT_MAX_LENGTH"
        :aria-invalid="reasonErrors.length > 0 || undefined"
        :aria-describedby="reasonErrors.length > 0 ? `${id}-reason-error` : undefined"
        :placeholder="reasonPlaceholder(status)"
      />
      <FieldErrors :id="`${id}-reason-error`" :messages="reasonErrors" />
    </div>
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
        :invalid="expiryErrors.length > 0"
        @touch="expiryTouched = true"
      />
      <FieldErrors :id="`${id}-expiry-error`" :messages="expiryErrors" />
    </div>
    <ReconfirmField v-if="reconfirmable" v-model="reconfirm" />
    <p v-if="status === 'fix_planned'" class="note">
      Fix planned leaves Triage, but alerts keep firing.
    </p>
    <p v-else-if="status !== null" class="note">
      Alerts stop within about two minutes, including alerts that already fire. Revoking or expiry
      brings the finding back at once; its alert fires again after the usual 30 minutes.
    </p>
    <FieldErrors :messages="serverErrors.general" role="alert" />
    <div class="actions" :class="{ sticky: stickyActions }">
      <KeyHint class="submit-hint" :keys="[MODIFIER_KEY, 'Enter']" />
      <BaseButton variant="ghost" @click="emit('cancel')">Cancel</BaseButton>
      <BaseButton type="submit" variant="primary" :disabled="submitting">
        {{ submitLabel }}
      </BaseButton>
    </div>
  </form>
</template>

<style scoped>
.decision-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5);
}

.label {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

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

.note {
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

.actions.sticky {
  position: sticky;
  bottom: 0;
  z-index: var(--z-raised);
  margin: 0 calc(-1 * var(--space-4));
  padding: var(--space-3) var(--space-4);
  border-top: var(--border-width) solid var(--color-border);
  background: var(--color-surface);
}

.submit-hint {
  margin-right: auto;
}
</style>
