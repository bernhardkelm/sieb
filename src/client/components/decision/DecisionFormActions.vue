<script setup lang="ts">
import { computed, inject } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import KeyHint from '@/components/common/KeyHint.vue'
import { STICKY_ACTIONS_TARGET } from '@/components/decision/stickyActionsTarget'
import { MODIFIER_KEY, MODIFIER_SHORTCUT } from '@/keyboard/modifierKey'

const props = defineProps<{
  submitting: boolean
  submitLabel: string
  /** Keeps the buttons visible at the bottom of the surrounding scroll container */
  sticky: boolean
  /** Id of the form Save submits, the buttons may render outside it */
  formId: string
}>()

defineEmits<{ cancel: [] }>()

const target = inject(STICKY_ACTIONS_TARGET, null)
const detached = computed(() => props.sticky && target !== null)
</script>

<template>
  <Teleport :to="target ?? 'body'" :disabled="!detached" defer>
    <div class="actions" :class="{ sticky, detached }">
      <KeyHint class="submit-hint" decorative :keys="[MODIFIER_KEY, 'Enter']" />
      <BaseButton variant="ghost" @click="$emit('cancel')">Cancel</BaseButton>
      <BaseButton
        type="submit"
        variant="primary"
        :form="formId"
        :disabled="submitting"
        :aria-keyshortcuts="`${MODIFIER_SHORTCUT}+Enter`"
      >
        {{ submitLabel }}
      </BaseButton>
    </div>
  </Teleport>
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

/* sits after the form's section in the panel body, closes the larger gap between sections */
.actions.detached {
  margin-top: calc(var(--space-3) - var(--space-6));
}

.submit-hint {
  margin-right: auto;
}
</style>
