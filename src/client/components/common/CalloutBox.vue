<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'info' | 'warning' | 'danger'
    /** Element that renders the box, a paragraph for a one-sentence notice */
    as?: 'div' | 'p' | 'section'
  }>(),
  { tone: 'info', as: 'div' },
)
</script>

<template>
  <component :is="as" class="callout" :class="tone">
    <slot />
    <div v-if="$slots.actions" class="actions">
      <slot name="actions" />
    </div>
  </component>
</template>

<style scoped>
.callout {
  --callout-color: var(--color-accent);
  --callout-wash: var(--color-accent-wash);

  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-left: var(--border-width-strong) solid var(--callout-color);
  border-radius: var(--radius-sm);
  background: var(--callout-wash);
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
}

p.callout {
  display: block;
}

.warning {
  --callout-color: var(--color-warning);
  --callout-wash: var(--color-warning-wash);
}

.danger {
  --callout-color: var(--color-danger);
  --callout-wash: var(--color-danger-wash);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
