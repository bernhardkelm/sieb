<script setup lang="ts">
import type { SourceAccess } from '#core/sourceAccess.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import type { ChipTone } from '@/components/chips/chipTone'
import HintTooltip from '@/components/common/HintTooltip.vue'
import { SOURCE_ACCESS_HINTS, SOURCE_ACCESS_LABELS } from '@/format/proposalLabels'

defineProps<{
  access: SourceAccess
}>()

const TONES: Record<SourceAccess, ChipTone> = {
  public: 'neutral',
  private: 'warning',
  unknown: 'neutral',
}
</script>

<template>
  <HintTooltip :text="SOURCE_ACCESS_HINTS[access]">
    <BaseChip
      :tone="TONES[access]"
      :outline="access !== 'private'"
      class="source-access-badge"
      :data-access="access"
      tabindex="0"
    >
      {{ SOURCE_ACCESS_LABELS[access] }}
    </BaseChip>
  </HintTooltip>
</template>

<style scoped>
.source-access-badge:focus-visible {
  outline: var(--border-width-strong) solid var(--color-focus);
  outline-offset: var(--border-width);
}
</style>
