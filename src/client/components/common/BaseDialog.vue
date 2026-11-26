<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'

import CloseButton from '@/components/common/CloseButton.vue'

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    /** Whether Esc, a click outside and the close button close the dialog, true by default */
    dismissible?: boolean
  }>(),
  { dismissible: true },
)

const open = defineModel<boolean>('open', { required: true })

defineEmits<{ openAutoFocus: [event: Event] }>()

/**
 * Keeps the dialog open on Esc or an outside interaction while it is not dismissible.
 * @param {Event} event - Escape key or outside interaction event
 * @returns {void}
 */
const preventDismiss = (event: Event): void => {
  if (!props.dismissible) {
    event.preventDefault()
  }
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="overlay" />
      <DialogContent
        class="content"
        @open-auto-focus="$emit('openAutoFocus', $event)"
        @escape-key-down="preventDismiss"
        @interact-outside="preventDismiss"
      >
        <header class="header">
          <DialogTitle class="title">{{ title }}</DialogTitle>
          <DialogClose v-if="dismissible" as-child>
            <CloseButton label="Close dialog" />
          </DialogClose>
        </header>
        <DialogDescription v-if="description" class="description">
          {{ description }}
        </DialogDescription>
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
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
  top: 12vh;
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

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.title {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.description {
  color: var(--color-text-muted);
}

@media (max-width: 639px) {
  .content {
    top: var(--space-2);
    width: calc(100vw - 2 * var(--space-2));
    max-height: calc(100dvh - 2 * var(--space-2));
    padding: var(--space-3) var(--space-3) var(--space-4) var(--space-4);
  }
}
</style>
