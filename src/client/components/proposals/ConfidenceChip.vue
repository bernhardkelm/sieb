<script setup lang="ts">
import type { ProposalConfidence } from '#core/proposal.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import { CONFIDENCE_TONES } from '@/components/chips/chipTones'
import { CONFIDENCE_LABELS } from '@/format/proposalLabels'

defineProps<{
  confidence: ProposalConfidence
}>()
</script>

<template>
  <BaseChip :tone="CONFIDENCE_TONES[confidence]" variant="dot" class="confidence-chip">
    {{ CONFIDENCE_LABELS[confidence] }}
  </BaseChip>
</template>
