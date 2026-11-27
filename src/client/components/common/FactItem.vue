<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>

<template>
  <div class="fact-item">
    <dt>{{ label }}</dt>
    <dd><slot /></dd>
  </div>
</template>

<style scoped>
.fact-item {
  min-width: 0;
}

dt {
  color: var(--color-text-subtle);
  font-size: var(--font-size-xs);
}

dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
</style>
