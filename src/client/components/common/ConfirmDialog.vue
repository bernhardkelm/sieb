<script setup lang="ts">
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'

import BaseButton from '@/components/common/BaseButton.vue'

withDefaults(
  defineProps<{
    title: string
    description: string
    confirmLabel?: string
    cancelLabel?: string
    /** Disables the buttons while the confirmed action runs */
    busy?: boolean
  }>(),
  { confirmLabel: 'Confirm', cancelLabel: 'Cancel', busy: false },
)

const open = defineModel<boolean>('open', { required: true })

defineEmits<{ confirm: []; closeAutoFocus: [event: Event] }>()
</script>

<template>
  <AlertDialogRoot v-model:open="open">
    <AlertDialogPortal>
      <AlertDialogOverlay class="overlay" />
      <AlertDialogContent class="content" @close-auto-focus="$emit('closeAutoFocus', $event)">
        <AlertDialogTitle class="title">{{ title }}</AlertDialogTitle>
        <AlertDialogDescription class="description">{{ description }}</AlertDialogDescription>
        <slot />
        <div class="actions">
          <AlertDialogCancel as-child>
            <BaseButton :disabled="busy">{{ cancelLabel }}</BaseButton>
          </AlertDialogCancel>
          <BaseButton variant="danger" :disabled="busy" @click="$emit('confirm')">
            {{ confirmLabel }}
          </BaseButton>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-dialog);
  background: var(--color-backdrop);
}

.content {
  position: fixed;
  top: 20vh;
  left: 50%;
  z-index: var(--z-dialog);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: min(var(--dialog-width), calc(100vw - 2 * var(--space-4)));
  max-height: 76vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-md);
  transform: translateX(-50%);
}

.content:focus-visible {
  outline: none;
}

.title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.description {
  color: var(--color-text-muted);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}

@media (max-width: 639px) {
  .content {
    top: var(--space-2);
    width: calc(100vw - 2 * var(--space-2));
    max-height: calc(100dvh - 2 * var(--space-2));
  }
}
</style>
