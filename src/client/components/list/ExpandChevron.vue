<script setup lang="ts">
defineProps<{
  expanded: boolean
}>()
</script>

<template>
  <svg
    class="expand-chevron"
    :class="{ expanded }"
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M6 4.5 9.5 8 6 11.5" />
  </svg>
</template>

<style scoped>
.expand-chevron {
  width: var(--chevron-size);
  height: var(--chevron-size);
  fill: none;
  stroke: var(--color-text-subtle);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform var(--duration-fast) var(--ease);
}

.expanded {
  stroke: var(--color-text);
  transform: rotate(90deg);
}
</style>
