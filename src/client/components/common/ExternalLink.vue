<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'

defineProps<{
  href: string
}>()
</script>

<template>
  <a class="external-link" :href="href" target="_blank" rel="noopener noreferrer">
    <slot />
    <AppIcon name="external" class="icon" />
    <span class="visually-hidden">, opens in a new tab</span>
  </a>
</template>

<style scoped>
.icon {
  --icon-size: var(--chip-icon-size);

  margin-left: var(--space-0-5);
  vertical-align: -0.1em;
}
</style>
