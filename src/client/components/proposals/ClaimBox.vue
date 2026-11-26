<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Marker naming the author of the content, empty to leave it out */
    tag?: string
  }>(),
  { tag: 'Claude says' },
)
</script>

<template>
  <div class="claim-box">
    <span v-if="tag" class="tag">{{ tag }}</span>
    <slot />
  </div>
</template>

<style scoped>
.claim-box {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) dashed color-mix(in srgb, var(--color-claim) 55%, transparent);
  border-radius: var(--radius);
  background: var(--color-claim-wash);
}

.tag {
  align-self: flex-start;
  padding: var(--space-0-5) var(--space-1-5);
  border-radius: var(--radius-sm);
  background: var(--color-claim);
  color: var(--color-on-claim);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-caps);
  text-transform: uppercase;
}
</style>
