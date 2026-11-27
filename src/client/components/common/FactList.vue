<script setup lang="ts">
withDefaults(
  defineProps<{
    /** inline wraps the facts on one line, grid gives each fact a column of equal width */
    layout?: 'inline' | 'grid'
  }>(),
  { layout: 'inline' },
)
</script>

<template>
  <dl class="fact-list" :class="layout">
    <slot />
  </dl>
</template>

<style scoped>
.fact-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-4);
  margin: 0;
  font-size: var(--font-size-sm);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(var(--fact-min-width), 1fr));
  gap: var(--space-2) var(--space-4);
}
</style>
