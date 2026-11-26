<script setup lang="ts">
defineProps<{
  unknowns: string[]
}>()
</script>

<template>
  <div v-if="unknowns.length > 0" class="unknowns-list" role="note">
    <p class="lead">Claude could not verify {{ unknowns.length === 1 ? 'this' : 'these' }}:</p>
    <ul class="items">
      <li v-for="(unknown, index) in unknowns" :key="index">{{ unknown }}</li>
    </ul>
  </div>
  <p v-else class="none">Claude lists nothing it could not verify.</p>
</template>

<style scoped>
.unknowns-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-left: var(--border-width-strong) solid var(--color-warning);
  border-radius: var(--radius-sm);
  background: var(--color-warning-wash);
}

.lead {
  font-weight: var(--font-weight-medium);
}

.items {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding-left: var(--space-5);
}

.items li {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.none {
  color: var(--color-text-subtle);
  font-size: var(--font-size-sm);
}
</style>
