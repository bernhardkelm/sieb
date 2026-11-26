<script setup lang="ts">
import type { ProposalConfidence } from '#core/proposal.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import type { ChipTone } from '@/components/chips/chipTone'
import { CONFIDENCE_LABELS } from '@/format/proposalLabels'

defineProps<{
  confidence: ProposalConfidence
}>()

const TONES: Record<ProposalConfidence, ChipTone> = {
  low: 'danger',
  medium: 'warning',
  high: 'success',
}
</script>

<template>
  <BaseChip :tone="TONES[confidence]" dot class="confidence-chip">
    {{ CONFIDENCE_LABELS[confidence] }}
  </BaseChip>
</template>
