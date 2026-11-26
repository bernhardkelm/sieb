<script setup lang="ts">
import { Toggle } from 'reka-ui'

defineProps<{
  label: string
}>()

const model = defineModel<boolean>({ required: true })
</script>

<template>
  <Toggle v-model="model" class="toggle-filter">{{ label }}</Toggle>
</template>

<style scoped>
.toggle-filter {
  height: var(--control-height);
  padding: 0 var(--space-2);
  border: var(--border-width) dashed var(--color-border-strong);
  border-radius: var(--radius);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.toggle-filter:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.toggle-filter[aria-pressed='true'] {
  border-style: solid;
  border-color: var(--color-accent);
  background: var(--color-selected);
  color: var(--color-text);
}
</style>
