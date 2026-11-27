<script setup lang="ts">
defineProps<{
  /** Claude-written entries, never rendered as HTML */
  missing: string[]
}>()
</script>

<template>
  <div class="missing-list" role="note">
    <p class="lead">Claude could not decide. To decide it would need:</p>
    <ul class="items">
      <li v-for="(entry, index) in missing" :key="index">{{ entry }}</li>
    </ul>
  </div>
</template>

<style scoped>
.missing-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-left: var(--border-width-strong) solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-severity-unknown-wash);
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
</style>
