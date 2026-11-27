<script setup lang="ts">
import { computed } from 'vue'

import { formatAbsolute } from '@/format/relativeTime'

const props = withDefaults(
  defineProps<{
    /** ISO time of the first sighting, the hint names it; null hints "Not seen yet" */
    since?: string | null
  }>(),
  { since: null },
)

const hint = computed(() =>
  props.since === null ? 'Not seen yet' : `New since ${formatAbsolute(props.since)}`,
)
</script>

<template>
  <span class="new-dot" :title="hint">
    <span class="dot" aria-hidden="true" />
    <span class="visually-hidden">New</span>
  </span>
</template>

<style scoped>
.new-dot {
  display: inline-flex;
  flex: none;
  align-items: center;
  height: 1lh;
  vertical-align: top;
}

.dot {
  width: var(--new-dot-size);
  height: var(--new-dot-size);
  border-radius: var(--radius-pill);
  background: var(--color-new);
}
</style>
