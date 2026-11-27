<script setup lang="ts">
import type { Exposure } from '#core/exposure.ts'
import { EXPOSURE_CAVEAT_SHORT, exposureMeaning } from '#core/exposureMeaning.ts'
import { EXPOSURE_FILTER_LABELS } from '@/format/labels'

defineProps<{
  /** Exposure of the workloads, null when they carry no exposure label */
  exposure: Exposure | null
}>()
</script>

<template>
  <p class="exposure-meaning" :data-exposure="exposure ?? 'unknown'">
    <span class="tier">{{ EXPOSURE_FILTER_LABELS[exposure ?? 'unknown'] }} exposure:</span>
    {{ exposureMeaning(exposure) }} {{ EXPOSURE_CAVEAT_SHORT }}
  </p>
</template>

<style scoped>
.exposure-meaning {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-tight);
}

.tier {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}
</style>
