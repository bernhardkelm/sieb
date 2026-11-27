<script setup lang="ts">
import { isTokenLive } from '#core/apiToken.ts'
import type { ApiTokenView } from '#core/tokenApiTypes.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import { TOKEN_SCOPE_LABELS } from '@/format/labels'

defineProps<{
  token: ApiTokenView
  now: Date
  /** Whether a delete of this token, or of all inactive ones, is in flight */
  deleting: boolean
}>()

defineEmits<{ revoke: []; delete: [] }>()
</script>

<template>
  <li
    class="token"
    :class="{ inactive: !isTokenLive(token, now) }"
    :data-token-id="token.id"
    tabindex="-1"
  >
    <div class="main">
      <span class="name">{{ token.name }}</span>
      <BaseChip variant="outline">{{ TOKEN_SCOPE_LABELS[token.scope] }}</BaseChip>
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
      @click="$emit('revoke')"
    >
      Revoke
    </BaseButton>
    <BaseButton
      v-else
      class="delete"
      variant="ghost"
      :aria-label="`Delete ${token.name}`"
      :disabled="deleting"
      @click="$emit('delete')"
    >
      Delete
    </BaseButton>
  </li>
</template>

<style scoped>
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
</style>
