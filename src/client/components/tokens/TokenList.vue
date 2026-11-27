<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import type { ApiTokenView } from '#core/tokenApiTypes.ts'
import BaseButton from '@/components/common/BaseButton.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import FieldErrors from '@/components/decision/FieldErrors.vue'
import TokenRow from '@/components/tokens/TokenRow.vue'
import { tokenErrorMessage } from '@/components/tokens/tokenErrorMessage'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useNow } from '@/composables/useNow'
import { useTokenDeletion } from '@/composables/useTokenDeletion'

const props = defineProps<{
  /** Live tokens first, then revoked and expired ones */
  tokens: ApiTokenView[]
  /** Revokes a token, rejects with the server error */
  revoke: (id: number) => Promise<void>
  /** Deletes a revoked or expired token, rejects with the server error */
  remove: (id: number) => Promise<void>
  /** Deletes every revoked or expired token, resolves the count */
  clearInactive: () => Promise<number>
}>()

const now = useNow()
const root = ref<HTMLElement | null>(null)
const list = ref<HTMLElement | null>(null)
const {
  inactive,
  busy: deleting,
  deleteOne,
  deleteAll,
} = useTokenDeletion({
  tokens: () => props.tokens,
  now,
  root,
  remove: (id) => props.remove(id),
  clearInactive: () => props.clearInactive(),
})
let revokedId: number | null = null

const revocation = useConfirmAction<ApiTokenView>(async (token) => {
  await props.revoke(token.id)
  revokedId = token.id
})
const { target: pending, open: confirmOpen, busy, ask, confirm } = revocation
const error = computed(() =>
  revocation.error.value === null ? null : tokenErrorMessage(revocation.error.value),
)

/**
 * Moves focus to the revoked row, its revoke button is gone, or back to the button after cancel.
 * @param {Event} event - Close auto focus event of the confirm dialog
 * @returns {Promise<void>} - Resolves once focused
 */
const onConfirmClosed = async (event: Event): Promise<void> => {
  const id = revokedId

  revokedId = null

  if (id === null) {
    return
  }

  event.preventDefault()
  await nextTick()
  list.value?.querySelector<HTMLElement>(`[data-token-id="${id}"]`)?.focus()
}
</script>

<template>
  <div ref="root" class="token-list" tabindex="-1">
    <p v-if="tokens.length === 0" class="empty">No tokens yet.</p>
    <ul v-else ref="list" class="tokens" aria-label="Your tokens">
      <TokenRow
        v-for="token in tokens"
        :key="token.id"
        :token="token"
        :now="now"
        :deleting="deleting === token.id || deleting === 'all'"
        @revoke="ask(token)"
        @delete="deleteOne(token)"
      />
    </ul>
    <div v-if="inactive.length > 0" class="footer">
      <BaseButton variant="ghost" :disabled="deleting !== null" @click="deleteAll">
        Clear inactive ({{ inactive.length }})
      </BaseButton>
    </div>
    <ConfirmDialog
      v-model:open="confirmOpen"
      title="Revoke token?"
      :description="`Claude clients using “${pending?.name ?? ''}” lose access at once. This cannot be undone.`"
      confirm-label="Revoke"
      :busy="busy"
      @confirm="confirm"
      @close-auto-focus="onConfirmClosed"
    >
      <FieldErrors v-if="error" :messages="[error]" role="alert" />
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.token-list:focus-visible {
  outline: var(--border-width-strong) solid var(--color-focus);
  outline-offset: var(--border-width-strong);
}

.empty {
  color: var(--color-text-muted);
}

.tokens {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.footer {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-2);
  border-top: var(--border-width) solid var(--color-border);
}
</style>
