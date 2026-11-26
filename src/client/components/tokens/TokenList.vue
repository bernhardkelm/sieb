<script setup lang="ts">
import { nextTick, ref } from 'vue'

import { isTokenLive } from '#core/apiToken.ts'
import type { ApiTokenView } from '#core/apiTypes.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import FieldErrors from '@/components/decision/FieldErrors.vue'
import { useNow } from '@/composables/useNow'
import { useTokenDeletion } from '@/composables/useTokenDeletion'
import { tokenErrorMessage } from '@/components/tokens/tokenErrorMessage'
import { TOKEN_SCOPE_LABELS } from '@/format/labels'

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
const pending = ref<ApiTokenView | null>(null)
const confirmOpen = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
let revokedId: number | null = null

/**
 * Asks to confirm the revocation of a token.
 * @param {ApiTokenView} token - Token to revoke
 * @returns {void}
 */
const ask = (token: ApiTokenView): void => {
  pending.value = token
  error.value = null
  confirmOpen.value = true
}

/**
 * Revokes the confirmed token, keeping the dialog open with the error when it fails.
 * @returns {Promise<void>}
 */
const confirm = async (): Promise<void> => {
  const token = pending.value

  if (token === null) {
    return
  }

  busy.value = true

  try {
    await props.revoke(token.id)
    revokedId = token.id
    confirmOpen.value = false
  } catch (failure) {
    error.value = tokenErrorMessage(failure)
  } finally {
    busy.value = false
  }
}

/**
 * Moves focus to the revoked row, its revoke button is gone, or back to the button after cancel.
 * @param {Event} event - Close auto focus event of the confirm dialog
 * @returns {Promise<void>}
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
      <li
        v-for="token in tokens"
        :key="token.id"
        class="token"
        :class="{ inactive: !isTokenLive(token, now) }"
        :data-token-id="token.id"
        tabindex="-1"
      >
        <div class="main">
          <span class="name">{{ token.name }}</span>
          <BaseChip outline>{{ TOKEN_SCOPE_LABELS[token.scope] }}</BaseChip>
          <BaseChip v-if="token.revokedAt !== null" tone="danger">Revoked</BaseChip>
          <BaseChip v-else-if="!isTokenLive(token, now)">Expired</BaseChip>
        </div>
        <code class="prefix">{{ token.prefix }}…</code>
        <dl class="times">
          <div>
            <dt>Created</dt>
            <dd><RelativeTime :value="token.createdAt" /></dd>
          </div>
          <div>
            <dt>Last used</dt>
            <dd><RelativeTime :value="token.lastUsedAt" fallback="never used" /></dd>
          </div>
          <div v-if="token.revokedAt !== null">
            <dt>Revoked</dt>
            <dd><RelativeTime :value="token.revokedAt" /></dd>
          </div>
          <div v-else>
            <dt>{{ isTokenLive(token, now) ? 'Expires' : 'Expired' }}</dt>
            <dd><RelativeTime :value="token.expiresAt" fallback="never" /></dd>
          </div>
        </dl>
        <BaseButton
          v-if="isTokenLive(token, now)"
          class="revoke"
          variant="ghost"
          :aria-label="`Revoke ${token.name}`"
          @click="ask(token)"
        >
          Revoke
        </BaseButton>
        <BaseButton
          v-else
          class="delete"
          variant="ghost"
          :aria-label="`Delete ${token.name}`"
          :disabled="deleting === token.id || deleting === 'all'"
          @click="deleteOne(token)"
        >
          Delete
        </BaseButton>
      </li>
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

.token {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-1) var(--space-2);
  padding: var(--space-2) 0;
  border-top: var(--border-width) solid var(--color-border);
}

.token:focus-visible {
  outline: var(--border-width-strong) solid var(--color-focus);
  outline-offset: calc(-1 * var(--border-width-strong));
}

.token.inactive {
  color: var(--color-text-subtle);
}

.main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1-5);
  min-width: 0;
}

.name {
  min-width: 0;
  font-weight: var(--font-weight-medium);
  overflow-wrap: anywhere;
}

.prefix {
  grid-column: 1;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}

.inactive .prefix {
  color: var(--color-text-subtle);
}

.times {
  display: flex;
  flex-wrap: wrap;
  grid-column: 1;
  gap: var(--space-1) var(--space-4);
  margin: 0;
  font-size: var(--font-size-sm);
}

.times dt {
  display: inline;
  color: var(--color-text-subtle);
}

.times dt::after {
  content: ' ';
}

.times dd {
  display: inline;
  margin: 0;
}

.revoke,
.delete {
  grid-row: 1;
  grid-column: 2;
  align-self: start;
}

.footer {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-2);
  border-top: var(--border-width) solid var(--color-border);
}
</style>
