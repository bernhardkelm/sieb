<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'

import { DECISION_STATUSES, type DecisionScope, type DecisionStatus } from '#core/decision.ts'
import BaseButton from '@/components/common/BaseButton.vue'
import KeyHint from '@/components/common/KeyHint.vue'
import ExpiryField from '@/components/decision/ExpiryField.vue'
import FieldErrors from '@/components/decision/FieldErrors.vue'
import RadioChoice from '@/components/decision/RadioChoice.vue'
import ReconfirmField from '@/components/decision/ReconfirmField.vue'
import { decisionFormErrors } from '@/components/decision/decisionFormErrors'
import {
  defaultExpiryDate,
  fromDateInput,
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
  }>(),
  {
    initial: () => ({}),
    scopeChoice: true,
    imageLabel: 'this image',
    submitting: false,
    submitLabel: 'Save decision',
    reconfirmable: false,
  },
)

const emit = defineEmits<{ submit: [value: DecisionFormValue]; cancel: []; dirty: [boolean] }>()

const id = useId()
const reasonInput = ref<HTMLTextAreaElement | null>(null)
const initialStatus = props.initial.status ?? 'not_affected'
const initialReason = props.initial.reason ?? ''
const initialScope = props.initial.scope ?? 'image'
const status = ref<DecisionStatus>(initialStatus)
const reason = ref(initialReason)
const scope = ref<DecisionScope>(initialScope)
const reconfirm = ref(false)
const expiryTouched = ref(false)

/**
 * Returns the date the form shows for a status while the expiry is untouched: the given expiry
 * for the starting status, the default of any other status, as the server applies it.
 * @param {DecisionStatus} next - Status
 * @returns {string | null} - Date as YYYY-MM-DD, null for no expiry
 */
const expiryDateFor = (next: DecisionStatus): string | null => {
  const given = props.initial.expiresAt

  if (given !== undefined && next === initialStatus) {
    return given === null ? null : toDateInput(given)
  }

  return defaultExpiryDate(next, new Date())
}

const initialDate = expiryDateFor(initialStatus)
const expiryDate = ref(initialDate ?? '')
const never = ref(initialDate === null)
const localErrors = ref<{ reason: string[]; expiresAt: string[] }>({ reason: [], expiresAt: [] })
const dirty = computed(
  () =>
    reason.value.trim() !== initialReason.trim() ||
    scope.value !== initialScope ||
    expiryTouched.value ||
    reconfirm.value,
)

const STATUS_OPTIONS = DECISION_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))
const scopeOptions = computed(() => [
  { value: 'image' as const, label: `Only ${props.imageLabel}` },
  { value: 'all' as const, label: 'All images' },
])

const serverErrors = computed(() => decisionFormErrors(props.error))
const reasonErrors = computed(() => [...localErrors.value.reason, ...serverErrors.value.reason])
const expiryErrors = computed(() => [
  ...localErrors.value.expiresAt,
  ...serverErrors.value.expiresAt,
])

watch(status, (next) => {
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
 * Checks the input and emits it; a blank reason or a missing date stops here.
 * @returns {void}
 */
const submit = (): void => {
  const expiresAt = never.value ? null : fromDateInput(expiryDate.value)

  localErrors.value = {
    reason: reason.value.trim() === '' ? ['A reason is required.'] : [],
    expiresAt: !never.value && expiresAt === null ? ['Pick a date or choose never.'] : [],
  }

  if (localErrors.value.reason.length > 0 || localErrors.value.expiresAt.length > 0) {
    if (localErrors.value.reason.length > 0) {
      reasonInput.value?.focus()
    }

    return
  }

  emit('submit', {
    status: status.value,
    reason: reason.value.trim(),
    scope: scope.value,
    expiresAt,
    expiryTouched: expiryTouched.value,
    reconfirm: props.reconfirmable && reconfirm.value,
  })
}

/**
 * Submits on Cmd+Enter or Ctrl+Enter from anywhere in the form.
 * @param {KeyboardEvent} event - Keydown event
 * @returns {void}
 */
const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    submit()
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
      <RadioChoice v-model="status" label="Status" :options="STATUS_OPTIONS" />
      <FieldErrors :messages="serverErrors.status" />
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
        placeholder="Why is this safe to silence, or what is the plan?"
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
      Fix planned leaves the inbox but does not silence alerts.
    </p>
    <p v-else class="note">
      Silencing takes effect within about two minutes and resolves alerts that already fire.
      Revoking or expiry brings the finding back at once; its alert fires again after the usual 30
      minutes.
    </p>
    <FieldErrors :messages="serverErrors.general" role="alert" />
    <div class="actions">
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

.submit-hint {
  margin-right: auto;
}
</style>
