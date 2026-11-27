<script setup lang="ts">
import type { Exposure } from '#core/exposure.ts'
import { exposureMeaning } from '#core/exposureMeaning.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import { EXPOSURE_LOOKS } from '@/components/chips/chipTones'
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
      :tone="EXPOSURE_LOOKS[exposure].tone"
      :variant="EXPOSURE_LOOKS[exposure].variant"
      class="exposure-chip"
      :data-exposure="exposure"
      :focusable="focusable"
    >
      {{ EXPOSURE_LABELS[exposure] }}
    </BaseChip>
  </HintTooltip>
</template>
