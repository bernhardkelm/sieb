<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="empty-state">
    <p class="title">{{ title }}</p>
    <p class="text"><slot /></p>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-12) var(--space-4);
  text-align: center;
}

.title {
  font-weight: var(--font-weight-medium);
}

.text {
  color: var(--color-text-muted);
}
</style>
