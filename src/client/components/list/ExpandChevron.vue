<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'

defineProps<{
  expanded: boolean
}>()
</script>

<template>
  <AppIcon class="expand-chevron" :class="{ expanded }" name="expand" />
</template>

<style scoped>
.expand-chevron {
  --icon-size: var(--chevron-size);

  color: var(--color-text-subtle);
  transition: transform var(--duration-fast) var(--ease);
}

.expanded {
  color: var(--color-text);
  transform: rotate(90deg);
}
</style>
