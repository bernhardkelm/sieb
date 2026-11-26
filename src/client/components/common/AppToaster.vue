<script setup lang="ts">
import {
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastRoot,
  ToastTitle,
  ToastViewport,
  useToastManager,
} from 'reka-ui'

const { toasts } = useToastManager()
</script>

<template>
  <!-- as-child renders root and viewport from this template, Reka moves class attrs off its scoped root -->
  <ToastRoot v-for="item in toasts" :key="item.id" :toast="item" as-child>
    <li class="toast" :class="item.status">
      <div class="text">
        <ToastTitle class="title" />
        <ToastDescription v-if="item.description" class="description" />
      </div>
      <ToastAction v-if="item.actionProps" class="action" />
      <ToastClose class="close" aria-label="Dismiss notification">×</ToastClose>
    </li>
  </ToastRoot>
  <ToastViewport as-child>
    <ol class="viewport" />
  </ToastViewport>
</template>

<style scoped>
.viewport {
  position: fixed;
  right: 0;
  bottom: var(--nav-inset);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: min(var(--toast-width), 100vw);
  margin: 0;
  padding: var(--space-4);
  list-style: none;
  outline: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-left: var(--border-width-strong) solid var(--color-border-strong);
  border-radius: var(--radius);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-md);
  color: var(--color-text);
}

.toast.success {
  border-left-color: var(--color-success);
}

.toast.error {
  border-left-color: var(--color-danger);
}

.text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-0-5);
  min-width: 0;
}

.title {
  font-weight: var(--font-weight-medium);
}

.description {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.action {
  align-self: center;
  height: var(--control-height);
  padding: 0 var(--space-2);
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.action:hover {
  background: var(--color-hover);
}

.close {
  padding: 0 var(--space-1);
  border: 0;
  background: transparent;
  color: var(--color-text-subtle);
  font-size: var(--font-size-lg);
  line-height: 1;
}

.close:hover {
  color: var(--color-text);
}

@media (hover: none) and (pointer: coarse) {
  .close {
    min-width: var(--touch-target);
    min-height: var(--touch-target);
    margin: calc(-1 * var(--space-2)) calc(-1 * var(--space-3)) calc(-1 * var(--space-2)) 0;
  }
}

@media (max-width: 639px) {
  .viewport {
    padding: var(--space-2);
  }
}
</style>
