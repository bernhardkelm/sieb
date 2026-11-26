<script setup lang="ts">
import { computed } from 'vue'

import type { Decision } from '#core/decision.ts'
import BaseChip from '@/components/chips/BaseChip.vue'
import HintTooltip from '@/components/common/HintTooltip.vue'
import { STATUS_LABELS } from '@/format/labels'
import { formatDate } from '@/format/relativeTime'

const props = defineProps<{
  decision: Decision
}>()

const hint = computed(() => {
  const expiry = props.decision.expiresAt
    ? `expires ${formatDate(props.decision.expiresAt)}`
    : 'never expires'

  return `Decision for all images, ${expiry}:\n${props.decision.reason}`
})
</script>

<template>
  <HintTooltip :text="hint">
    <BaseChip tone="accent" outline>All · {{ STATUS_LABELS[decision.status] }}</BaseChip>
  </HintTooltip>
</template>
