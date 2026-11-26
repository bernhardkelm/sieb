<script setup lang="ts">
defineProps<{
  /** Accessible name, such as "Close panel" */
  label: string
}>()
</script>

<template>
  <button type="button" class="close-button" :aria-label="label" aria-keyshortcuts="Escape">
    <span class="key" aria-hidden="true">Esc</span>
    <svg class="icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  </button>
</template>

<style scoped>
.close-button {
  display: inline-grid;
  flex: none;
  place-items: center;
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
  width: var(--icon-size);
  height: var(--icon-size);
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
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
