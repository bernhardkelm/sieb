<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import KeyHint from '@/components/common/KeyHint.vue'
import ConflictNotice from '@/components/proposals/ConflictNotice.vue'
import { MODIFIER_KEY } from '@/keyboard/modifierKey'

defineProps<{
  /** Disables the actions while a command runs */
  busy: boolean
  /** The decisions changed since the reviewer saw them, both accepts wait for Review again */
  conflict: boolean
  /** A keyboard accept was refused because the proposal was not reviewed long enough */
  chordRefused: boolean
}>()

defineEmits<{ accept: []; edit: []; reject: []; acknowledge: [] }>()
</script>

<template>
  <div class="proposal-actions">
    <ConflictNotice v-if="conflict" @acknowledge="$emit('acknowledge')" />
    <p v-else-if="chordRefused" class="arm-hint" role="status">
      {{ MODIFIER_KEY }} Enter accepts once this proposal has been read: click into it or scroll
      with the arrow keys, then press it again.
    </p>
    <div class="buttons">
      <KeyHint class="hint" :keys="[MODIFIER_KEY, 'Enter']" />
      <BaseButton variant="ghost" :disabled="busy" @click="$emit('reject')">Reject</BaseButton>
      <BaseButton :disabled="busy || conflict" @click="$emit('edit')">
        Edit &amp; accept
      </BaseButton>
      <BaseButton variant="primary" :disabled="busy || conflict" @click="$emit('accept')">
        Accept
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.proposal-actions {
  position: sticky;
  bottom: 0;
  z-index: var(--z-raised);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: var(--border-width) solid var(--color-border);
  background: var(--color-surface);
}

.arm-hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.buttons {
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
