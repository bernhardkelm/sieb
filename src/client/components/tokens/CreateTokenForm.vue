<script setup lang="ts">
import { computed, ref, useId } from 'vue'

import { MAX_TOKEN_NAME_LENGTH, type ApiTokenScope } from '#core/apiToken.ts'
import type { ApiTokenCreateRequest } from '#core/apiTypes.ts'
import BaseButton from '@/components/common/BaseButton.vue'
import FieldErrors from '@/components/decision/FieldErrors.vue'
import RadioChoice from '@/components/decision/RadioChoice.vue'
import {
  localNameErrors,
  noTokenFormErrors,
  tokenFormErrors,
  type TokenFormErrors,
} from '@/components/tokens/tokenFormErrors'
import { EXPIRY_OPTIONS, expiryDate, type ExpiryChoice } from '@/components/tokens/tokenExpiry'
import { TOKEN_SCOPE_LABELS } from '@/format/labels'

const props = defineProps<{
  /** Creates the token, rejects with the server error */
  create: (input: ApiTokenCreateRequest) => Promise<void>
}>()

const SCOPE_OPTIONS: { value: ApiTokenScope; label: string; hint?: string; disabled?: boolean }[] =
  [
    { value: 'read', label: TOKEN_SCOPE_LABELS.read, hint: 'Claude can look up findings' },
    {
      value: 'propose',
      label: TOKEN_SCOPE_LABELS.propose,
      hint: 'Claude can also file proposals for you to review, never decisions',
    },
  ]

const id = useId()
const nameInput = ref<HTMLInputElement | null>(null)
const name = ref('')
const scope = ref<ApiTokenScope | null>('read')
const expiry = ref<ExpiryChoice | null>('90')
const submitted = ref(false)
const submitting = ref(false)
const serverErrors = ref<TokenFormErrors>(noTokenFormErrors())

const nameErrors = computed(() =>
  submitted.value ? [...localNameErrors(name.value), ...serverErrors.value.name] : [],
)

/**
 * Focuses the name input.
 * @returns {void}
 */
const focus = (): void => {
  nameInput.value?.focus()
}

/**
 * Creates the token unless the name is missing, and shows the server errors otherwise.
 * @returns {Promise<void>}
 */
const submit = async (): Promise<void> => {
  submitted.value = true
  serverErrors.value = noTokenFormErrors()

  if (localNameErrors(name.value).length > 0) {
    focus()
    return
  }

  submitting.value = true

  try {
    await props.create({
      name: name.value.trim(),
      scope: scope.value ?? 'read',
      expiresAt: expiryDate(expiry.value ?? '90', new Date()),
    })
    name.value = ''
    submitted.value = false
  } catch (error) {
    serverErrors.value = tokenFormErrors(error)
  } finally {
    submitting.value = false
  }
}

defineExpose({ focus })
</script>

<template>
  <form
    class="create-token-form"
    novalidate
    :aria-labelledby="`${id}-title`"
    @submit.prevent="submit"
  >
    <h3 :id="`${id}-title`" class="heading">New token</h3>
    <div class="field">
      <label :for="`${id}-name`" class="label">Name</label>
      <input
        :id="`${id}-name`"
        ref="nameInput"
        v-model="name"
        class="name"
        type="text"
        autocomplete="off"
        required
        :maxlength="MAX_TOKEN_NAME_LENGTH"
        placeholder="Claude Code on my laptop"
        :aria-invalid="nameErrors.length > 0 || undefined"
        :aria-describedby="nameErrors.length > 0 ? `${id}-name-error` : undefined"
      />
      <FieldErrors :id="`${id}-name-error`" :messages="nameErrors" />
    </div>
    <div class="field">
      <span class="label">Access</span>
      <RadioChoice v-model="scope" label="Access" :options="SCOPE_OPTIONS" />
      <p class="note">
        Propose lets Claude create proposals only. A decision exists once you accept a proposal in
        the Inbox, and nothing is muted before that.
      </p>
      <FieldErrors :messages="serverErrors.scope" />
    </div>
    <div class="field">
      <span class="label">Expires</span>
      <RadioChoice v-model="expiry" label="Expires" :options="EXPIRY_OPTIONS" />
      <FieldErrors :messages="serverErrors.expiresAt" />
    </div>
    <FieldErrors :messages="serverErrors.general" role="alert" />
    <div class="actions">
      <BaseButton type="submit" variant="primary" :disabled="submitting">Create token</BaseButton>
    </div>
  </form>
</template>

<style scoped>
.create-token-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.heading {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
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

.name {
  height: var(--control-height);
  padding: 0 var(--space-2);
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.note {
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
}

.name[aria-invalid='true'] {
  border-color: var(--color-danger);
}

.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
