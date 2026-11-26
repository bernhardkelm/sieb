<script setup lang="ts">
import type { ThemeChoice } from '@/composables/useTheme'

defineProps<{
  choice: ThemeChoice
}>()
</script>

<template>
  <svg class="theme-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <g v-if="choice === 'light'">
      <circle cx="8" cy="8" r="3" />
      <path
        d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"
      />
    </g>
    <g v-else-if="choice === 'dark'">
      <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z" />
    </g>
    <g v-else>
      <rect x="2" y="3" width="12" height="8" rx="1.5" />
      <path d="M6 14h4M8 11v3" />
    </g>
  </svg>
</template>

<style scoped>
.theme-icon {
  width: var(--icon-size);
  height: var(--icon-size);
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
