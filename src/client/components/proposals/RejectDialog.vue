<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'

import { PROPOSAL_LIMITS } from '#core/proposal.ts'
import { ApiError } from '@/api/ApiError'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import KeyHint from '@/components/common/KeyHint.vue'
import FieldErrors from '@/components/decision/FieldErrors.vue'
import { errorCodeMessage } from '@/format/labels'
import { MODIFIER_KEY, MODIFIER_SHORTCUT } from '@/keyboard/modifierKey'

const props = defineProps<{
  vulnId: string
  /** Dismisses an inconclusive proposal, same command and reason rule as a reject */
  dismiss?: boolean
  busy: boolean
  /** Failure of the last reject, validation errors of the reason are shown */
  error: unknown
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{ confirm: [reason: string] }>()

const id = useId()
const reason = ref('')
const submitted = ref(false)

const messages = computed(() => {
  const local = submitted.value && reason.value.trim() === '' ? ['Required.'] : []
  const server =
    props.error instanceof ApiError && props.error.isValidation
      ? props.error.fieldErrors('reason').map(errorCodeMessage)
      : []

  return [...local, ...server]
})

watch(open, (value) => {
  if (value) {
    reason.value = ''
    submitted.value = false
  }
})

/**
 * Emits the reason unless it is blank.
 * @returns {void}
 */
const submit = (): void => {
  submitted.value = true

  if (reason.value.trim() !== '') {
    emit('confirm', reason.value)
  }
}

/**
 * Submits on Cmd+Enter or Ctrl+Enter in the reason, never on a key repeat.
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
</script>

<template>
  <BaseDialog
    v-model:open="open"
    :title="`${dismiss ? 'Dismiss' : 'Reject'} the proposal for ${vulnId}?`"
    :description="
      dismiss
        ? 'Nothing is decided. Claude reads your reason back when it lists its proposals.'
        : 'Claude reads your reason back when it lists its proposals, so say what is wrong or missing.'
    "
  >
    <form class="reject-form" novalidate @submit.prevent="submit" @keydown="onKeydown">
      <label :for="id" class="label">Reason</label>
      <textarea
        :id="id"
        v-model="reason"
        class="reason"
        required
        :maxlength="PROPOSAL_LIMITS.rejectReason"
        placeholder="The parser is reachable through the upload endpoint."
        :aria-invalid="messages.length > 0 || undefined"
        :aria-describedby="messages.length > 0 ? `${id}-error` : undefined"
      />
      <FieldErrors :id="`${id}-error`" :messages="messages" />
      <div class="actions">
        <KeyHint class="hint" decorative :keys="[MODIFIER_KEY, 'Enter']" />
        <BaseButton :disabled="busy" @click="open = false">Cancel</BaseButton>
        <BaseButton
          type="submit"
          :variant="dismiss ? 'primary' : 'danger'"
          :disabled="busy"
          :aria-keyshortcuts="`${MODIFIER_SHORTCUT}+Enter`"
        >
          {{ dismiss ? 'Dismiss' : 'Reject' }}
        </BaseButton>
      </div>
    </form>
  </BaseDialog>
</template>

<style scoped>
.reject-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
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

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

.hint {
  margin-right: auto;
}
</style>
