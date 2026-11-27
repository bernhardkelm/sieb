<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Heading level, 2 on a page, 3 inside a panel */
    level?: 2 | 3
    /** Number shown after the title in a quieter style, null leaves it out */
    count?: number | null
  }>(),
  { level: 3, count: null },
)
</script>

<template>
  <component :is="`h${level}`" class="section-heading caps-label">
    <slot />
    <template v-if="count !== null"> {{ ' ' }}<span class="count">{{ count }}</span> </template>
    <span v-if="$slots.aside" class="aside"><slot name="aside" /></span>
  </component>
</template>

<style scoped>
.count {
  color: var(--color-text-subtle);
  font-weight: var(--font-weight-regular);
}

.aside {
  display: inline-flex;
  margin-left: var(--space-2);
  font-weight: var(--font-weight-medium);
  letter-spacing: normal;
  text-transform: none;
}
</style>
