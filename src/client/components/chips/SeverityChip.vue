<script setup lang="ts">
import { computed } from 'vue'

import type { Severity } from '#core/severity.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import type { ChipTone } from '@/components/chips/chipTone'
import HintTooltip from '@/components/common/HintTooltip.vue'

const props = withDefaults(
  defineProps<{
    severity: Severity
    /** Set to "cvss" when the cluster re-rated the vendor severity, shown as a suffix */
    source?: string | null
    score?: number | null
  }>(),
  { source: null, score: null },
)

const tone = computed(() => props.severity.toLowerCase() as ChipTone)

const hint = computed(() => {
  const score = props.score === null ? 'no score' : `score ${props.score}`

  return props.source ? `Re-rated from ${props.source}, ${score}` : `Severity, ${score}`
})
</script>

<template>
  <HintTooltip :text="hint">
    <BaseChip :tone="tone" class="severity-chip">
      {{ severity }}
      <span v-if="source" class="source">{{ source }}</span>
    </BaseChip>
  </HintTooltip>
</template>

<style scoped>
.severity-chip {
  min-width: calc(var(--space-base) * 15);
  justify-content: center;
}

.source {
  opacity: 0.75;
  font-weight: var(--font-weight-regular);
}
</style>
