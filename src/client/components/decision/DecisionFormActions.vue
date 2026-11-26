<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import KeyHint from '@/components/common/KeyHint.vue'
import { MODIFIER_KEY, MODIFIER_SHORTCUT } from '@/keyboard/modifierKey'

defineProps<{
  submitting: boolean
  submitLabel: string
  /** Keeps the buttons visible at the bottom of the surrounding scroll container */
  sticky: boolean
}>()

defineEmits<{ cancel: [] }>()
</script>

<template>
  <div class="actions" :class="{ sticky }">
    <KeyHint class="submit-hint" decorative :keys="[MODIFIER_KEY, 'Enter']" />
    <BaseButton variant="ghost" @click="$emit('cancel')">Cancel</BaseButton>
    <BaseButton
      type="submit"
      variant="primary"
      :disabled="submitting"
      :aria-keyshortcuts="`${MODIFIER_SHORTCUT}+Enter`"
    >
      {{ submitLabel }}
    </BaseButton>
  </div>
</template>

<style scoped>
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
