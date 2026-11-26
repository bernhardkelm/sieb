<script setup lang="ts">
import { computed } from 'vue'

import { SPARK_BOX, sparklineGeometry, type SparkPoint } from '@/components/overview/sparkline'

const props = defineProps<{
  points: SparkPoint[]
  /** Trend in words, the accessible name */
  label: string
  /** First and last value, shown on hover */
  title: string
}>()

const geometry = computed(() => sparklineGeometry(props.points))
const viewBox = `0 0 ${SPARK_BOX.width} ${SPARK_BOX.height}`
</script>

<template>
  <span v-if="geometry" class="stat-sparkline" role="img" :aria-label="label" :title="title">
    <svg
      class="plot"
      :viewBox="viewBox"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path class="area" :d="geometry.area" />
      <path class="line" :d="geometry.line" />
    </svg>
    <!-- end dot in HTML, the stretched viewBox would distort an SVG circle -->
    <span
      class="dot"
      aria-hidden="true"
      :style="{ left: `${geometry.end.xPercent}%`, top: `${geometry.end.yPercent}%` }"
    />
  </span>
</template>

<style scoped>
.stat-sparkline {
  position: relative;
  display: block;
  height: var(--sparkline-height);
}

.plot {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.area {
  fill: var(--color-sparkline-fill);
}

.line {
  fill: none;
  stroke: var(--color-sparkline);
  stroke-width: var(--sparkline-stroke);
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.dot {
  position: absolute;
  width: var(--sparkline-dot-size);
  height: var(--sparkline-dot-size);
  border-radius: var(--radius-pill);
  background: var(--color-sparkline);
  box-shadow: 0 0 0 var(--border-width-strong) var(--stat-surface, var(--color-stat-surface));
  transform: translate(-50%, -50%);
}

@media (forced-colors: active) {
  .line {
    stroke: CanvasText;
  }

  .dot {
    background: CanvasText;
  }
}
</style>
