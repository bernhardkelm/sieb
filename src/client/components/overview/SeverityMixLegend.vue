<script setup lang="ts">
import { severityColor, type SeveritySegment } from '@/components/overview/severityMix'
import { formatCount } from '@/format/count'

defineProps<{
  segments: SeveritySegment[]
}>()
</script>

<template>
  <ul class="severity-legend">
    <li v-for="segment in segments" :key="segment.key" class="entry">
      <span class="swatch" :style="{ background: severityColor(segment.key) }" aria-hidden="true" />
      <span class="name">{{ segment.label }}</span>
      <span class="count">{{ formatCount(segment.count) }}</span>
      <span class="share">{{ segment.shareLabel }}</span>
    </li>
    <li v-if="segments.length === 0" class="entry none">No open findings</li>
  </ul>
</template>

<style scoped>
.severity-legend {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: var(--space-1) var(--space-2);
  margin: 0;
  padding: 0;
  font-size: var(--font-size-sm);
  list-style: none;
}

.entry {
  display: contents;
}

.none {
  display: block;
  grid-column: 1 / -1;
  color: var(--color-text-muted);
}

.swatch {
  align-self: center;
  width: var(--dot-size);
  height: var(--dot-size);
  border-radius: var(--radius-pill);
}

.count,
.share {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.share {
  color: var(--color-text-muted);
}
</style>
