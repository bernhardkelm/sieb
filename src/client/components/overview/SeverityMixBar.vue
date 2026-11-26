<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'
import { computed } from 'vue'

import type { SeverityCounts } from '#core/overviewStats.ts'
import {
  describeSeverityMix,
  severityColor,
  severitySegments,
} from '@/components/overview/severityMix'
import SeverityMixLegend from '@/components/overview/SeverityMixLegend.vue'

const props = withDefaults(
  defineProps<{
    counts: SeverityCounts
    /** Shows the legend below the bar instead of in a tooltip, for touch screens */
    inlineLegend?: boolean
  }>(),
  { inlineLegend: false },
)

const segments = computed(() => severitySegments(props.counts))
const description = computed(() => `Severity mix: ${describeSeverityMix(segments.value)}`)
</script>

<template>
  <div class="severity-mix">
    <span class="caption" aria-hidden="true">Severity mix</span>
    <TooltipRoot :disabled="inlineLegend || segments.length === 0">
      <TooltipTrigger as-child>
        <div
          class="bar"
          :class="{ empty: segments.length === 0 }"
          role="img"
          :aria-label="description"
          :tabindex="inlineLegend ? undefined : 0"
        >
          <span
            v-for="segment in segments"
            :key="segment.key"
            class="segment"
            :style="{ flexGrow: segment.count, background: severityColor(segment.key) }"
          />
        </div>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent as-child side="right" :side-offset="8" :collision-padding="8">
          <div class="mix-tooltip">
            <SeverityMixLegend :segments="segments" />
          </div>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
    <SeverityMixLegend v-if="inlineLegend" :segments="segments" />
  </div>
</template>

<style scoped>
.severity-mix {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.caption {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.bar {
  display: flex;
  gap: var(--severity-bar-gap);
  height: var(--severity-bar-height);
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: transparent;
}

.bar.empty {
  background: var(--color-border);
}

.segment {
  flex-basis: 0;
  flex-shrink: 0;
  min-width: var(--severity-bar-gap);
}

.mix-tooltip {
  z-index: var(--z-tooltip);
  padding: var(--space-1-5) var(--space-2);
  border-radius: var(--radius);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-md);
  color: var(--color-text);
}

@media (forced-colors: active) {
  .segment {
    border: var(--border-width) solid CanvasText;
  }
}
</style>
