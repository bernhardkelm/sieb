<script setup lang="ts">
defineProps<{
  label: string
  /** Id of the label, for content that names itself by it */
  labelId?: string
}>()
</script>

<template>
  <div class="panel-line">
    <span :id="labelId" class="caps-label">{{ label }}</span>
    <slot />
  </div>
</template>

<style scoped>
.panel-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
}
</style>
