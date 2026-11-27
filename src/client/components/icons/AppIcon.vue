<script setup lang="ts">
import { ICON_PATHS, type IconName } from '@/components/icons/iconPaths'

defineProps<{
  name: IconName
}>()
</script>

<!-- size and stroke come from --icon-size and --icon-stroke, a caller overrides those variables -->
<template>
  <svg class="app-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path v-for="path in ICON_PATHS[name]" :key="path" :d="path" />
  </svg>
</template>

<style scoped>
.app-icon {
  flex: none;
  width: var(--icon-size);
  height: var(--icon-size);
  fill: none;
  stroke: currentColor;
  stroke-width: var(--icon-stroke);
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
