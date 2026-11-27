<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'

import {
  ACCESS_PROVIDERS,
  PROVIDER_SPECS,
  type AccessCredentialView,
  type AccessProvider,
} from '#core/privateAccess.ts'
import { MAX_CREDENTIAL_LABEL_LENGTH } from '#core/credentialFieldReaders.ts'
import ClaudeNotice from '@/components/access/ClaudeNotice.vue'
import CredentialFacts from '@/components/access/CredentialFacts.vue'
import { credentialHostsOf } from '@/components/access/credentialHosts'
import type { CredentialFormModel } from '@/components/access/credentialFormModel'
import HostFields from '@/components/access/HostFields.vue'
import PathPrefixField from '@/components/access/PathPrefixField.vue'
import ProviderInstructions from '@/components/access/ProviderInstructions.vue'
import RepoMappingField from '@/components/access/RepoMappingField.vue'
import UsesField from '@/components/access/UsesField.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import TextField from '@/components/common/TextField.vue'
import FieldErrors from '@/components/decision/FieldErrors.vue'
import RadioChoice from '@/components/decision/RadioChoice.vue'
import { useCredentialForm } from '@/composables/useCredentialForm'

const props = defineProps<{
  /** Credential to edit, null to add one */
  credential: AccessCredentialView | null
  /** Saves the values, rejects with the server error */
  save: (model: CredentialFormModel) => Promise<void>
}>()

defineEmits<{ cancel: [] }>()

const PROVIDER_OPTIONS = ACCESS_PROVIDERS.map((value) => ({
  value,
  label: PROVIDER_SPECS[value].label,
}))

const USERNAME_HINTS: Record<AccessProvider, string> = {
  github: '',
  gitlab: 'The username GitLab shows for the deploy token, such as gitlab+deploy-token-12.',
  dockerhub: 'Your Docker Hub username.',
}

const id = useId()
const form = ref<HTMLFormElement | null>(null)
const { model, editing, errors, submitting, setProvider, setUse, submit } = useCredentialForm(
  props.credential,
  props.save,
)

const spec = computed(() => PROVIDER_SPECS[model.value.provider])
const hosts = computed(() => credentialHostsOf(model.value))
const title = computed(() =>
  props.credential === null ? 'Add credential' : `Edit ${props.credential.label}`,
)

/**
 * Focuses the first field of the form.
 * @returns {void}
 */
const focus = (): void => {
  form.value?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"], input')?.focus()
}

/**
 * Saves the form, or focuses the first invalid field when a check or the server refused it.
 * @returns {Promise<void>}
 */
const onSubmit = async (): Promise<void> => {
  if (await submit()) {
    return
  }

  await nextTick()
  form.value
    ?.querySelector<HTMLElement>('[aria-invalid="true"] input, input[aria-invalid="true"]')
    ?.focus()
}

defineExpose({ focus })
</script>

<template>
  <form
    ref="form"
    class="credential-form"
    novalidate
    :aria-labelledby="`${id}-title`"
    @submit.prevent="onSubmit"
  >
    <div class="top">
      <h2 :id="`${id}-title`" class="heading">{{ title }}</h2>
      <CredentialFacts v-if="credential" :credential="credential" />
      <div v-else class="field">
        <span class="label">Provider</span>
        <RadioChoice
          :model-value="model.provider"
          label="Provider"
          :options="PROVIDER_OPTIONS"
          @update:model-value="(value) => value && setProvider(value)"
        />
        <FieldErrors :messages="errors.provider" />
      </div>
    </div>
    <ProviderInstructions class="instructions" :provider="model.provider" :uses="model.uses" />
    <div class="fields">
      <TextField
        v-model="model.label"
        label="Label"
        placeholder="GitLab your-group"
        required
        :maxlength="MAX_CREDENTIAL_LABEL_LENGTH"
        :errors="errors.label"
      />
      <template v-if="!editing">
        <UsesField
          :provider="model.provider"
          :uses="model.uses"
          :registry-host="hosts.registry"
          :git-host="hosts.git"
          :errors="errors.uses"
          @set="setUse"
        />
        <HostFields
          v-if="spec.customHost"
          v-model:registry-host="model.registryHost"
          v-model:git-host="model.gitHost"
          :uses="model.uses"
          :registry-errors="errors.registryHost"
          :git-errors="errors.gitHost"
        />
      </template>
      <PathPrefixField
        v-model="model.pathPrefix"
        :hosts="hosts.covered"
        :errors="errors.pathPrefix"
      />
      <RepoMappingField
        v-if="model.uses.includes('git')"
        v-model:registry-prefix="model.registryPrefix"
        v-model:repo-prefix="model.repoPrefix"
        :registry-host="hosts.registry || 'registry.example.com'"
        :git-host="hosts.git"
        :errors="errors.repoMapping"
      />
      <TextField
        v-if="spec.needsUsername"
        v-model="model.username"
        label="Username"
        :hint="USERNAME_HINTS[model.provider]"
        mono
        required
        :errors="errors.username"
      />
      <TextField
        v-model="model.secret"
        :label="editing ? 'Replace token' : 'Token'"
        type="password"
        autocomplete="new-password"
        :hint="
          editing
            ? 'Leave empty to keep the stored token. sieb never shows a stored token.'
            : 'Stored encrypted. sieb never shows it again.'
        "
        mono
        :required="!editing"
        :errors="errors.secret"
      />
      <ClaudeNotice />
      <FieldErrors :messages="errors.general" role="alert" />
      <div class="actions">
        <BaseButton @click="$emit('cancel')">Cancel</BaseButton>
        <BaseButton type="submit" variant="primary" :disabled="submitting">
          {{ editing ? 'Save changes' : 'Add credential' }}
        </BaseButton>
      </div>
    </div>
  </form>
</template>

<style scoped src="@/components/access/credentialForm.css"></style>
