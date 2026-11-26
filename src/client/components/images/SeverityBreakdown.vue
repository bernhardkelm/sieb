<script setup lang="ts">
import { computed } from 'vue'

import type { Severity } from '#core/severity.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import type { ChipTone } from '@/components/chips/chipTone'
import HintTooltip from '@/components/common/HintTooltip.vue'
import { describeSeverityBreakdown, severityBreakdown } from '@/components/images/severityBreakdown'

const props = defineProps<{
  /** Open findings per severity */
  bySeverity: Record<Severity, number>
}>()

const counts = computed(() => severityBreakdown(props.bySeverity))
const description = computed(() => describeSeverityBreakdown(counts.value))
</script>

<template>
  <HintTooltip :text="description">
    <span class="severity-breakdown" role="img" :aria-label="description">
      <BaseChip
        v-for="{ severity, count } in counts"
        :key="severity"
        class="count"
        :class="{ zero: count === 0 }"
        :tone="count === 0 ? 'neutral' : (severity.toLowerCase() as ChipTone)"
        :outline="count === 0"
      >
        {{ count }}
      </BaseChip>
    </span>
  </HintTooltip>
</template>

<style scoped>
.severity-breakdown {
  display: inline-flex;
  gap: var(--space-1);
}

.count {
  justify-content: center;
  min-width: calc(var(--space-base) * 7);
  font-variant-numeric: tabular-nums;
}

.zero {
  color: var(--color-text-subtle);
  opacity: 0.55;
}
</style>
