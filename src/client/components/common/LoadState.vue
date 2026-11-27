<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'

withDefaults(
  defineProps<{
    /** What is loading, such as "findings" */
    subject: string
    /** Failure of the last load, null while it is still loading */
    error: string | null
    /** Message for a load that failed because the item does not exist, shown without Retry */
    notFound?: string | null
  }>(),
  { notFound: null },
)

defineEmits<{ retry: [] }>()
</script>

<template>
  <p v-if="error === null" class="load-state" role="status">Loading {{ subject }}…</p>
  <p v-else-if="notFound !== null" class="load-state" role="alert">{{ notFound }}</p>
  <div v-else class="load-state" role="alert">
    <p>Could not load {{ subject }}: {{ error }}</p>
    <BaseButton @click="$emit('retry')">Retry</BaseButton>
  </div>
</template>

<style scoped>
.load-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-4);
  color: var(--color-text-muted);
}
</style>
