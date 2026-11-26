<script setup lang="ts">
defineProps<{
  keys: string[]
}>()
</script>

<template>
  <span class="key-hint">
    <kbd v-for="key in keys" :key="key">{{ key }}</kbd>
  </span>
</template>

<style scoped>
.key-hint {
  display: inline-flex;
  gap: var(--space-0-5);
}

kbd {
  min-width: var(--chip-height);
  padding: 0 var(--space-1);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  line-height: calc(var(--chip-height) - 2 * var(--border-width));
  text-align: center;
}

@media (hover: none) and (pointer: coarse) {
  .key-hint {
    display: none;
  }
}
</style>
