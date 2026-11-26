<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import type { ApiTokenCreateRequest } from '#core/apiTypes.ts'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import CreateTokenForm from '@/components/tokens/CreateTokenForm.vue'
import { fallbackMcpUrl } from '@/components/tokens/mcpSetup'
import NewTokenSecret from '@/components/tokens/NewTokenSecret.vue'
import TokenList from '@/components/tokens/TokenList.vue'
import { useApiTokens } from '@/composables/useApiTokens'
import { useMcpStore } from '@/stores/mcpStore'

const open = defineModel<boolean>('open', { required: true })

const { tokens, loading, loadError, created, load, create, revoke, clearSecret } = useApiTokens()
const mcp = useMcpStore()

const form = ref<InstanceType<typeof CreateTokenForm> | null>(null)
const secretBlock = ref<InstanceType<typeof NewTokenSecret> | null>(null)

const mcpUrl = computed(() => mcp.info?.mcpUrl ?? fallbackMcpUrl(window.location.origin))

/**
 * Creates a token and focuses its one-time secret.
 * @param {ApiTokenCreateRequest} input - Name, scope and expiry
 * @returns {Promise<void>}
 * @throws {ApiError} - When the server refuses the token, the form shows it
 */
const createAndReveal = async (input: ApiTokenCreateRequest): Promise<void> => {
  await create(input)
  await nextTick()
  secretBlock.value?.focus()
}

/**
 * Dismisses the secret and returns to the form.
 * @returns {Promise<void>}
 */
const onSecretDone = async (): Promise<void> => {
  clearSecret()
  await nextTick()
  form.value?.focus()
}

/**
 * Focuses the name input instead of the close button when the dialog opens.
 * @param {Event} event - Open auto focus event
 * @returns {void}
 */
const onOpenAutoFocus = (event: Event): void => {
  event.preventDefault()
  void nextTick(() => form.value?.focus())
}

watch(
  open,
  (isOpen) => {
    if (isOpen) {
      void load()
    } else {
      clearSecret()
    }
  },
  { immediate: true },
)
</script>

<template>
  <BaseDialog
    v-model:open="open"
    title="API tokens"
    description="Personal tokens let Claude Code read sieb through MCP. Each token acts as you."
    :dismissible="created === null"
    @open-auto-focus="onOpenAutoFocus"
  >
    <NewTokenSecret
      v-if="created"
      ref="secretBlock"
      :name="created.token.name"
      :secret="created.secret"
      :mcp-url="mcpUrl"
      :oauth="mcp.info?.oauth ?? false"
      @done="onSecretDone"
    />
    <CreateTokenForm v-else ref="form" :create="createAndReveal" />
    <section class="tokens" aria-labelledby="api-tokens-list" :aria-busy="loading">
      <h3 id="api-tokens-list" class="heading">
        Your tokens
        <LoadingSpinner v-if="loading" />
      </h3>
      <div v-if="loadError" class="error" role="alert">
        <p>Could not load the tokens: {{ loadError }}</p>
        <BaseButton @click="load()">Retry</BaseButton>
      </div>
      <TokenList v-else-if="!loading || tokens.length > 0" :tokens="tokens" :revoke="revoke" />
    </section>
  </BaseDialog>
</template>

<style scoped>
.tokens {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.heading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  color: var(--color-danger);
}
</style>
