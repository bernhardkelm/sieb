<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'

defineEmits<{ acknowledge: [] }>()
</script>

<template>
  <div class="conflict-notice" role="alert">
    <p class="text">
      The decisions changed while you reviewed this proposal. Check the current decisions, then
      review again to accept.
    </p>
    <BaseButton class="again" @click="$emit('acknowledge')">Review again</BaseButton>
  </div>
</template>

<style scoped>
.conflict-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-left: var(--border-width-strong) solid var(--color-warning);
  border-radius: var(--radius-sm);
  background: var(--color-warning-wash);
  font-size: var(--font-size-sm);
}

.text {
  flex: 1;
  margin: 0;
  font-weight: var(--font-weight-medium);
}
</style>
