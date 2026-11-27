<script setup lang="ts">
import CopyButton from '@/components/common/CopyButton.vue'

withDefaults(
  defineProps<{
    value: string
    /** Accessible name of the copy button, such as "Copy token" */
    label: string
    /** Sets the value in a heavier weight, for a secret shown once */
    emphasis?: boolean
  }>(),
  { emphasis: false },
)
</script>

<template>
  <div class="copy-field">
    <code class="value" :class="{ emphasis }">{{ value }}</code>
    <CopyButton :value="value" :label="label" />
  </div>
</template>

<style scoped>
.copy-field {
  display: flex;
  align-items: flex-start;
  gap: var(--space-1);
}

.value {
  flex: 1;
  min-width: 0;
  padding: var(--space-1-5) var(--space-2);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
  user-select: all;
}

.emphasis {
  font-weight: var(--font-weight-medium);
}
</style>
