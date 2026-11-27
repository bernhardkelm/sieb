<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    /** start for a page that explains a feature, center for an empty list */
    align?: 'center' | 'start'
  }>(),
  { align: 'center' },
)
</script>

<template>
  <div class="empty-state" :class="align">
    <p class="title">{{ title }}</p>
    <p class="text"><slot /></p>
    <div v-if="$slots.actions" class="actions">
      <slot name="actions" />
    </div>
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

.start {
  gap: var(--space-2);
  max-width: var(--prose-max-width);
  text-align: left;
}

.title {
  font-weight: var(--font-weight-medium);
}

.text {
  color: var(--color-text-muted);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.start .actions {
  justify-content: flex-start;
}
</style>
