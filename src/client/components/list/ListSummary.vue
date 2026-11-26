<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'

withDefaults(
  defineProps<{
    /** Active custom sort, such as "Severity, descending"; null for the default order */
    sortLabel?: string | null
  }>(),
  { sortLabel: null },
)

defineEmits<{ resetSort: [] }>()
</script>

<template>
  <div class="list-summary">
    <p class="text" role="status">
      <slot />
      <span v-if="sortLabel !== null"> · sorted by {{ sortLabel }}</span>
    </p>
    <div v-if="sortLabel !== null || $slots.actions" class="actions">
      <BaseButton v-if="sortLabel !== null" variant="ghost" @click="$emit('resetSort')">
        Default order
      </BaseButton>
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.list-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-1) var(--space-3);
  min-height: calc(var(--font-size-sm) * var(--line-height-body) + 2 * var(--space-2));
  padding: var(--space-1) var(--space-4);
  border-bottom: var(--border-width) solid var(--color-border);
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
}

@media (max-width: 639px) {
  .list-summary {
    padding-inline: var(--space-3);
  }
}
</style>
