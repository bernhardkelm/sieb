<script setup lang="ts">
import { computed } from 'vue'

import BaseChip from '@/components/chips/BaseChip.vue'
import HintTooltip from '@/components/common/HintTooltip.vue'
import { UPSTREAM_PENDING_LABEL, waitingForText } from '@/format/upstreamText'

const props = defineProps<{
  /** Release or image the fix waits for, shown in the tooltip */
  waitingFor: string | null
}>()

const hint = computed(() => waitingForText(props.waitingFor))
</script>

<template>
  <HintTooltip :text="hint">
    <BaseChip class="upstream-pending-chip" tone="warning" outline>
      {{ UPSTREAM_PENDING_LABEL }}
    </BaseChip>
  </HintTooltip>
</template>
