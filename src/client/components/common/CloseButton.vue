<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'
defineProps<{
  /** Accessible name, such as "Close panel" */
  label: string
}>()
</script>

<template>
  <button type="button" class="close-button" :aria-label="label" aria-keyshortcuts="Escape">
    <span class="key" aria-hidden="true">Esc</span>
    <AppIcon class="icon" name="close" />
  </button>
</template>

<style scoped>
.close-button {
  display: inline-grid;
  flex: none;
  place-items: center;
  min-height: var(--control-height);
  padding: 0 var(--space-1-5);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.close-button:hover {
  color: var(--color-text);
}

.icon {
  display: none;
}

@media (hover: none) and (pointer: coarse), (max-width: 639px) {
  .close-button {
    width: var(--touch-target);
    height: var(--touch-target);
    padding: 0;
    border-color: var(--color-border-strong);
    border-radius: var(--radius);
    color: var(--color-text);
  }

  .key {
    display: none;
  }

  .icon {
    display: block;
  }
}
</style>
