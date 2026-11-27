<script setup lang="ts">
import { computed } from 'vue'

import type { DecisionJustification } from '#core/decision.ts'
import type { ProposalVerdict } from '#core/proposal.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import { VERDICT_TONES } from '@/components/chips/chipTones'
import { verdictLabel } from '@/components/proposals/proposalText'

const props = withDefaults(
  defineProps<{
    verdict: ProposalVerdict
    justification?: DecisionJustification | null
    /** Large for the review header, small for rows and notices */
    size?: 'lg' | 'sm'
  }>(),
  { justification: null, size: 'sm' },
)

const label = computed(() => verdictLabel(props.verdict, props.justification))
</script>

<template>
  <BaseChip
    class="verdict-chip"
    :class="verdict"
    :tone="VERDICT_TONES[verdict]"
    variant="framed"
    :size="size"
  >
    {{ label }}
  </BaseChip>
</template>
