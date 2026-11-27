<script setup lang="ts">
import type { ChipTone } from '@/components/chips/chipTone'

withDefaults(
  defineProps<{
    tone?: ChipTone
  }>(),
  { tone: 'neutral' },
)
</script>

<template>
  <span class="status-dot" :class="tone" aria-hidden="true" />
</template>

<style scoped>
.status-dot {
  --tone-color: var(--color-text-muted);

  flex: none;
  width: var(--dot-size);
  height: var(--dot-size);
  border-radius: var(--radius-pill);
  background: var(--tone-color);
}
</style>

<style scoped src="@/components/chips/toneColors.css"></style>
