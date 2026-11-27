<script setup lang="ts">
import type { Exposure } from '#core/exposure.ts'
import { exposureMeaning } from '#core/exposureMeaning.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import HintTooltip from '@/components/common/HintTooltip.vue'
import { EXPOSURE_LABELS } from '@/format/labels'

withDefaults(
  defineProps<{
    exposure: Exposure
    /** Makes the chip a tab stop that opens its tooltip on focus, never inside a list row */
    focusable?: boolean
  }>(),
  { focusable: false },
)
</script>

<template>
  <HintTooltip :text="exposureMeaning(exposure)">
    <BaseChip
      :tone="exposure === 'public' ? 'warning' : 'neutral'"
      :outline="exposure !== 'public'"
      class="exposure-chip"
      :data-exposure="exposure"
      :tabindex="focusable ? 0 : undefined"
    >
      {{ EXPOSURE_LABELS[exposure] }}
    </BaseChip>
  </HintTooltip>
</template>

<style scoped>
.exposure-chip:focus-visible {
  outline: var(--border-width-strong) solid var(--color-focus);
  outline-offset: var(--border-width);
}
</style>
